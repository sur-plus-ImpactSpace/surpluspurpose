import type { User } from "@surplus/domain";
import { NextRequest } from "next/server";
import { adminEmailAllowed } from "../../_lib/admin-bootstrap-email";
import { enforceRouteRateLimit } from "../../_lib/rate-limit";
import { routeJson } from "../../_lib/route-workspace";

export const dynamic = "force-dynamic";
const endpointId = "admin.bootstrap";
const bootstrapTokenHeader = "x-surplus-bootstrap-token";

type SupabaseAuthUser = {
  email: string;
  userId: string;
};

type SupabaseServiceConfig = {
  anonKey: string;
  serviceRoleKey: string;
  url: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "corporate" | "ngo";
  company_id: string | null;
  ngo_id: string | null;
  created_at: string;
};

export async function POST(request: NextRequest) {
  const bootstrap = bootstrapGate(request);
  if (!bootstrap.ok) return routeJson({ error: bootstrap.reason }, bootstrap.status);

  const config = supabaseServiceConfig();
  if (!config.ok) return routeJson({ error: config.reason }, 503);

  const authUser = await resolveSupabaseAuthUser(request, config.config);
  if (!authUser.ok) return routeJson({ error: authUser.reason }, authUser.status);
  if (!adminEmailAllowed(authUser.user.email)) {
    return routeJson({ error: "bootstrap_email_not_allowed" }, 403);
  }

  const rateLimit = await enforceRouteRateLimit({
    actorId: authUser.user.userId,
    endpointId,
    policy: "strict"
  });
  if (rateLimit) return rateLimit;

  const body = (await request.json().catch(() => null)) as { fullName?: unknown } | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() || null : null;

  const existing = await fetchExistingUser(config.config, authUser.user.userId);
  if (!existing.ok) return routeJson({ error: existing.reason }, 503);
  if (existing.user?.role === "admin") {
    return routeJson({ runtime: "service-role-bootstrap", state: "already_admin", user: existing.user }, 200);
  }
  if (existing.user) return routeJson({ error: "user_already_provisioned" }, 409);

  const created = await createAdminUser(config.config, authUser.user, fullName);
  if (!created.ok) return routeJson({ error: created.reason }, 503);
  await writeBootstrapAuditEvent(config.config, created.user.id);

  return routeJson({ runtime: "service-role-bootstrap", state: "created", user: created.user }, 201);
}

function bootstrapGate(
  request: NextRequest
):
  | { ok: true }
  | { ok: false; reason: "bootstrap_not_configured" | "bootstrap_token_required"; status: 401 | 503 } {
  const expectedToken = process.env.SURPLUS_ADMIN_BOOTSTRAP_TOKEN;
  if (!expectedToken) return { ok: false, reason: "bootstrap_not_configured", status: 503 };

  return request.headers.get(bootstrapTokenHeader) === expectedToken
    ? { ok: true }
    : { ok: false, reason: "bootstrap_token_required", status: 401 };
}

function supabaseServiceConfig():
  | { ok: true; config: SupabaseServiceConfig }
  | { ok: false; reason: "supabase_not_configured" | "service_role_not_configured" } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) return { ok: false, reason: "supabase_not_configured" };
  if (!serviceRoleKey) return { ok: false, reason: "service_role_not_configured" };

  return {
    ok: true,
    config: {
      anonKey,
      serviceRoleKey,
      url
    }
  };
}

async function resolveSupabaseAuthUser(
  request: NextRequest,
  config: SupabaseServiceConfig
): Promise<{ ok: true; user: SupabaseAuthUser } | { ok: false; reason: "auth_required" | "auth_unavailable"; status: 401 | 503 }> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, reason: "auth_required", status: 401 };
  }

  const response = await fetch(new URL("/auth/v1/user", normalizedSupabaseUrl(config.url)), {
    headers: {
      apikey: config.anonKey,
      authorization
    },
    cache: "no-store"
  });
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "auth_required", status: 401 };
  }
  if (!response.ok) return { ok: false, reason: "auth_unavailable", status: 503 };

  const payload = (await response.json().catch(() => null)) as { email?: unknown; id?: unknown } | null;
  if (!payload || typeof payload.id !== "string" || typeof payload.email !== "string") {
    return { ok: false, reason: "auth_required", status: 401 };
  }

  return {
    ok: true,
    user: {
      email: payload.email.trim().toLowerCase(),
      userId: payload.id
    }
  };
}

async function fetchExistingUser(
  config: SupabaseServiceConfig,
  userId: string
): Promise<{ ok: true; user: User | null } | { ok: false; reason: "bootstrap_unavailable" }> {
  const endpoint = new URL("/rest/v1/users", normalizedSupabaseUrl(config.url));
  endpoint.searchParams.set("id", `eq.${userId}`);
  endpoint.searchParams.set("select", "*");
  const response = await fetch(endpoint, {
    headers: serviceHeaders(config),
    cache: "no-store"
  });
  if (!response.ok) return { ok: false, reason: "bootstrap_unavailable" };

  const rows = (await response.json().catch(() => [])) as UserRow[];

  return {
    ok: true,
    user: rows[0] ? userFromRow(rows[0]) : null
  };
}

async function createAdminUser(
  config: SupabaseServiceConfig,
  authUser: SupabaseAuthUser,
  fullName: string | null
): Promise<{ ok: true; user: User } | { ok: false; reason: "bootstrap_unavailable" }> {
  const response = await fetch(new URL("/rest/v1/users", normalizedSupabaseUrl(config.url)), {
    method: "POST",
    headers: {
      ...serviceHeaders(config),
      "content-type": "application/json",
      prefer: "return=representation"
    },
    body: JSON.stringify({
      id: authUser.userId,
      email: authUser.email,
      full_name: fullName,
      role: "admin",
      company_id: null,
      ngo_id: null
    }),
    cache: "no-store"
  });
  if (!response.ok) return { ok: false, reason: "bootstrap_unavailable" };

  const rows = (await response.json().catch(() => [])) as UserRow[];
  const row = rows[0];
  if (!row) return { ok: false, reason: "bootstrap_unavailable" };

  return {
    ok: true,
    user: userFromRow(row)
  };
}

async function writeBootstrapAuditEvent(config: SupabaseServiceConfig, userId: string): Promise<void> {
  await fetch(new URL("/rest/v1/audit_events", normalizedSupabaseUrl(config.url)), {
    method: "POST",
    headers: {
      ...serviceHeaders(config),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      actor: userId,
      action: "admin.bootstrap",
      target: userId,
      visibility: "admin_only"
    }),
    cache: "no-store"
  }).catch(() => undefined);
}

function serviceHeaders(config: SupabaseServiceConfig): Record<string, string> {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`
  };
}

function normalizedSupabaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? "",
    role: row.role,
    companyId: row.company_id,
    ngoId: row.ngo_id,
    createdAt: row.created_at
  };
}

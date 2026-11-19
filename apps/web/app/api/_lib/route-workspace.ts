import {
  createInMemoryRepository,
  createSeedData,
  createSupabaseRestRepository,
  type ActorContext,
  type RepositoryData,
  type SupabaseRestConfig,
  type SurplusRepository,
  type User
} from "@surplus/domain";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEMO_COOKIE, getSandbox } from "../../lib/demo-sandbox";
import { resolvePreviewActor } from "./preview-actor";

export type RouteWorkspace =
  | {
      runtime: "preview";
      actor: ActorContext;
      data: RepositoryData;
      repository: SurplusRepository;
      supabase: null;
    }
  | {
      runtime: "supabase";
      actor: ActorContext;
      data: RepositoryData;
      repository: SurplusRepository;
      supabase: SupabaseRestConfig;
    };

export type RouteWorkspaceDecision =
  | { ok: true; workspace: RouteWorkspace }
  | { ok: false; response: NextResponse };

let previewWorkspace: Pick<RouteWorkspace, "data" | "repository"> | null = null;

export async function loadRouteWorkspace(request: NextRequest): Promise<RouteWorkspaceDecision> {
  const supabaseConfig = supabaseConfigFromRequest(request);
  if (supabaseConfig.enabled && !supabaseConfig.config) {
    return {
      ok: false,
      response: routeJson({ error: supabaseConfig.reason }, supabaseConfig.status)
    };
  }

  if (supabaseConfig.config) {
    try {
      const authUser = await resolveSupabaseAuthUser(supabaseConfig.config);
      if (!authUser.ok) return { ok: false, response: authUser.response };

      const { data, repository } = await createSupabaseRestRepository(supabaseConfig.config);
      const actor = resolveActorFromCurrentUser(data.users.find((user) => user.id === authUser.userId));
      if (!actor) {
        return { ok: false, response: routeJson({ error: "actor_not_available" }, 401) };
      }
      // REQ-NFR-03 / REQ-OPS-14: Ops acts only with a second factor. The database
      // refuses admin|editor rights below aal2 too (0032/0059); failing here
      // first gives the client a clear reason instead of a permission error.
      if (
        (actor.role === "admin" || actor.role === "editor") &&
        bearerAssuranceLevel(supabaseConfig.config.authorization) !== "aal2"
      ) {
        return { ok: false, response: routeJson({ error: "mfa_required" }, 403) };
      }

      return {
        ok: true,
        workspace: {
          runtime: "supabase",
          actor,
          data,
          repository,
          supabase: supabaseConfig.config
        }
      };
    } catch (error) {
      console.error("Supabase route workspace load failed", error);

      return { ok: false, response: routeJson({ error: "workspace_unavailable" }, 503) };
    }
  }

  if (!previewMutationsAllowed()) {
    return {
      ok: false,
      response: routeJson({ error: "production_runtime_not_configured" }, 503)
    };
  }

  // A demo visitor works in their own sandbox (cookie set by /demo/enter); an
  // expired one is told so rather than silently landing in someone else's data.
  const sandboxId = request.cookies.get(DEMO_COOKIE)?.value;
  const sandbox = sandboxId ? getSandbox(sandboxId) : undefined;
  if (sandboxId && !sandbox) {
    return { ok: false, response: routeJson({ error: "demo_expired" }, 410) };
  }
  const { data, repository } = sandbox ?? getPreviewWorkspace();
  const actor = resolvePreviewActor(data, request.headers.get("x-surplus-preview-user-id"));
  if (!actor) {
    return { ok: false, response: routeJson({ error: "actor_not_available" }, 401) };
  }

  return {
    ok: true,
    workspace: {
      runtime: "preview",
      actor,
      data,
      repository,
      supabase: null
    }
  };
}

export type PublicRouteRuntime =
  | { ok: true; runtime: "supabase"; supabase: SupabaseRestConfig }
  | { ok: true; runtime: "preview"; repository: SurplusRepository }
  | { ok: false; response: NextResponse };

/**
 * Runtime for routes anyone may call without a session (the "Request access"
 * form). Supabase whenever it is configured — it is then called with the anon
 * key only — otherwise the preview repository, under the same production guard
 * as every other preview mutation.
 */
export function loadPublicRouteRuntime(): PublicRouteRuntime {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) return { ok: true, runtime: "supabase", supabase: { url, key } };

  if (!previewMutationsAllowed()) {
    return { ok: false, response: routeJson({ error: "production_runtime_not_configured" }, 503) };
  }

  return { ok: true, runtime: "preview", repository: getPreviewWorkspace().repository };
}

export function routeJson(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function supabaseConfigFromRequest(
  request: NextRequest
):
  | { enabled: false; config: null }
  | { enabled: true; config: SupabaseRestConfig }
  | { enabled: true; config: null; reason: string; status: 401 | 503 } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");
  const explicitSupabase = process.env.SURPLUS_ROUTE_RUNTIME === "supabase";
  const hasAuthenticatedSupabaseRequest = Boolean(url && key && authorization);

  if (!explicitSupabase && !hasAuthenticatedSupabaseRequest) {
    return { enabled: false, config: null };
  }
  if (!url || !key) {
    return { enabled: true, config: null, reason: "supabase_not_configured", status: 503 };
  }
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return { enabled: true, config: null, reason: "auth_required", status: 401 };
  }

  return {
    enabled: true,
    config: {
      url,
      key,
      authorization
    }
  };
}

async function resolveSupabaseAuthUser(
  config: SupabaseRestConfig
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = new URL("/auth/v1/user", normalizedSupabaseUrl(config.url));
  const response = await fetchImpl(endpoint, {
    headers: {
      apikey: config.key,
      authorization: config.authorization ?? `Bearer ${config.key}`
    },
    cache: "no-store"
  });

  if (response.status === 401 || response.status === 403) {
    return { ok: false, response: routeJson({ error: "auth_required" }, 401) };
  }
  if (!response.ok) {
    return { ok: false, response: routeJson({ error: "auth_unavailable" }, 503) };
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
  if (!payload || typeof payload.id !== "string" || !payload.id.trim()) {
    return { ok: false, response: routeJson({ error: "auth_required" }, 401) };
  }

  return { ok: true, userId: payload.id };
}

/**
 * The `aal` claim of the bearer JWT. Only read after /auth/v1/user accepted the
 * token, so the claims are the ones Supabase Auth signed. Null if unreadable.
 */
export function bearerAssuranceLevel(authorization: string | undefined): string | null {
  const token = authorization?.replace(/^bearer\s+/i, "") ?? "";
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { aal?: unknown };
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

function normalizedSupabaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function previewMutationsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SURPLUS_ALLOW_PREVIEW_MUTATIONS === "true";
}

function getPreviewWorkspace(): Pick<RouteWorkspace, "data" | "repository"> {
  if (!previewWorkspace) {
    const data = createSeedData();
    previewWorkspace = {
      data,
      repository: createInMemoryRepository(data)
    };
  }

  return previewWorkspace;
}

function resolveActorFromCurrentUser(user: User | undefined): ActorContext | null {
  if (!user) return null;
  if (user.role === "corporate" && user.companyId) {
    return {
      role: "corporate",
      userId: user.id,
      companyId: user.companyId
    };
  }
  if (user.role === "ngo" && user.ngoId) {
    return {
      role: "ngo",
      userId: user.id,
      ngoId: user.ngoId
    };
  }
  if (user.role === "admin") {
    return {
      role: "admin",
      userId: user.id
    };
  }
  if (user.role === "editor") {
    return {
      role: "editor",
      userId: user.id
    };
  }

  return null;
}

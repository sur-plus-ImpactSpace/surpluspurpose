import {
  SupabaseRepositoryError,
  acceptInvitationWithSupabaseRpc,
  parseInvitationAcceptanceCommand,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { enforceRouteRateLimit } from "../../_lib/rate-limit";
import { routeJson } from "../../_lib/route-workspace";

export const dynamic = "force-dynamic";
const endpointId = "invitations.accept";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseInvitationAcceptanceCommand(body);
  if (!command.ok) return routeJson({ error: command.reason }, command.status);

  const supabaseConfig = supabaseConfigFromRequest(request);
  if (!supabaseConfig.ok) return routeJson({ error: supabaseConfig.reason }, supabaseConfig.status);

  const authUser = await resolveSupabaseAuthUser(supabaseConfig.config);
  if (!authUser.ok) return routeJson({ error: authUser.reason }, authUser.status);

  const rateLimit = await enforceRouteRateLimit({
    actorId: authUser.userId,
    endpointId,
    policy: "strict"
  });
  if (rateLimit) return rateLimit;

  try {
    const user = await acceptInvitationWithSupabaseRpc(supabaseConfig.config, {
      acceptanceToken: command.command.token,
      fullName: command.command.fullName
    });

    return routeJson({ runtime: "supabase-rpc", user }, 200);
  } catch (error) {
    const reason = invitationAcceptanceSupabaseErrorReason(error);

    return routeJson({ error: reason }, statusForInvitationAcceptanceError(reason));
  }
}

function supabaseConfigFromRequest(
  request: NextRequest
):
  | { ok: true; config: SupabaseRestConfig }
  | { ok: false; reason: "auth_required" | "supabase_not_configured"; status: 401 | 503 } {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !key) return { ok: false, reason: "supabase_not_configured", status: 503 };
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return { ok: false, reason: "auth_required", status: 401 };
  }

  return {
    ok: true,
    config: {
      url,
      key,
      authorization
    }
  };
}

async function resolveSupabaseAuthUser(
  config: SupabaseRestConfig
): Promise<{ ok: true; userId: string } | { ok: false; reason: "auth_required" | "auth_unavailable"; status: 401 | 503 }> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const response = await fetchImpl(new URL("/auth/v1/user", normalizedSupabaseUrl(config.url)), {
    headers: {
      apikey: config.key,
      authorization: config.authorization ?? `Bearer ${config.key}`
    },
    cache: "no-store"
  });

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "auth_required", status: 401 };
  }
  if (!response.ok) {
    return { ok: false, reason: "auth_unavailable", status: 503 };
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
  if (!payload || typeof payload.id !== "string" || !payload.id.trim()) {
    return { ok: false, reason: "auth_required", status: 401 };
  }

  return { ok: true, userId: payload.id };
}

function normalizedSupabaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function statusForInvitationAcceptanceError(reason: string): 401 | 403 | 409 | 422 | 503 {
  if (reason === "auth_required") return 401;
  if (reason === "invitation_email_mismatch" || reason === "user_already_provisioned") return 403;
  if (reason === "seat_limit_exceeded") return 409;
  if (reason === "invitation_unavailable") return 503;

  return 422;
}

function invitationAcceptanceSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "invitation_unavailable";

  const knownReasons = [
    "auth_required",
    "invalid_invitation_token",
    "invitation_expired",
    "invitation_email_mismatch",
    "user_already_provisioned",
    "seat_limit_exceeded",
    "company_not_found",
    "ngo_not_found"
  ];
  const message = error.message;
  const reason = knownReasons.find((item) => message.includes(item));

  return reason ?? "invitation_unavailable";
}

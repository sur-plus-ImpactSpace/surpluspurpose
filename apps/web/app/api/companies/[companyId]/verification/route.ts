import { NextRequest } from "next/server";
import { supabaseBrowserConfigFromEnv } from "../../../../lib/service-chat-realtime";
import { adminMfaMissing, loadServerSupabaseSession } from "../../../../lib/server-supabase";
import { WorkspaceProfileMissingError, loadWorkspaceData } from "../../../../lib/workspace-data";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

const ACTIONS = ["approve", "request_info", "reject", "start_review"];

/**
 * Ops-only corporate verification action (ADR 0027 C1). Admin session → the
 * security-definer set_company_verification RPC (which re-checks admin, and
 * refuses 'approve' until a business proof exists). Preview/demo has no backend,
 * so it returns 503.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  const action = typeof body.action === "string" ? body.action : "";
  if (!ACTIONS.includes(action)) {
    return Response.json({ error: "invalid_action" }, { status: 422 });
  }

  const authConfig = supabaseBrowserConfigFromEnv();
  if (!authConfig) {
    return Response.json({ error: "persistence_unavailable" }, { status: 503 });
  }

  const session = await loadServerSupabaseSession(authConfig);
  if (!session) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }

  const workspace = await loadWorkspaceData({
    authorization: `Bearer ${session.accessToken}`,
    preferredUserId: session.userId
  }).catch((error: unknown) => {
    if (error instanceof WorkspaceProfileMissingError) return null;
    throw error;
  });
  if (!workspace || workspace.actor.role !== "admin") {
    return Response.json({ error: "actor_not_allowed" }, { status: 403 });
  }
  if (adminMfaMissing(workspace.actor.role, session)) {
    return Response.json({ error: "mfa_required" }, { status: 403 });
  }

  const response = await fetch(`${authConfig.supabaseUrl}/rest/v1/rpc/set_company_verification`, {
    method: "POST",
    headers: {
      apikey: authConfig.anonKey,
      authorization: `Bearer ${session.accessToken}`,
      "content-type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify({ p_company_id: companyId, p_action: action })
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { message?: string };
    const reason = errorReason(detail.message);
    return Response.json({ error: reason }, { status: statusForReason(reason) });
  }

  const company = await response.json();
  return Response.json({ company });
}

function errorReason(message: string | undefined): string {
  const known = [
    "verification_document_required",
    "actor_not_allowed",
    "company_not_found",
    "invalid_action",
    "auth_required"
  ];
  const hit = known.find((item) => message?.includes(item));
  if (hit) return hit;
  if (message?.includes("invalid input syntax for type uuid")) return "company_not_found";
  return "persistence_unavailable";
}

function statusForReason(reason: string): 401 | 403 | 404 | 409 | 422 | 503 {
  if (reason === "auth_required") return 401;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "company_not_found") return 404;
  if (reason === "verification_document_required") return 409;
  if (reason === "invalid_action") return 422;
  return 503;
}

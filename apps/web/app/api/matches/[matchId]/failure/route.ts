import {
  SupabaseRepositoryError,
  failMatchWithSupabaseRpc,
  parseMatchFailureCommand,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ matchId: string }> };

/**
 * Ops-only: the goods shipped and delivery broke down. Unless the NGO is at
 * fault the company's quota unit is refunded (ADR 0028 D4). Before shipping the
 * ending is a cancellation via /transition instead.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { matchId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const command = parseMatchFailureCommand(request.headers, matchId, body);
  if (!command.ok) return routeJson({ error: command.reason }, command.status);

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "matches.fail";
  const rateLimit = await enforceRouteRateLimit({ actorId: actor.userId, endpointId, policy: "strict" });
  if (rateLimit) return rateLimit;

  const input = {
    ngoAtFault: command.command.ngoAtFault,
    ...(command.command.reason ? { reason: command.command.reason } : {})
  };
  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: { matchId: command.command.matchId, ...input }
  });
  if (idempotency.kind === "response") return idempotency.response;

  const result =
    runtime === "supabase"
      ? await failPersistentMatch(supabase, command.command.matchId, input)
      : repository.matches.fail(actor, command.command.matchId, input);

  if (!result.ok) {
    const status = statusForFailureError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({ responseStatus: status, responseBody: response });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    match: result.match,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "match",
    resourceId: result.match.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function statusForFailureError(reason: string): 401 | 403 | 404 | 409 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "match_not_found") return 404;
  if (reason === "terminal_state" || reason === "not_shipped") return 409;
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function failPersistentMatch(
  supabase: SupabaseRestConfig,
  matchId: string,
  input: { ngoAtFault: boolean; reason?: string }
) {
  try {
    return await failMatchWithSupabaseRpc(supabase, { matchId, ...input });
  } catch (error) {
    return { ok: false as const, reason: failureSupabaseErrorReason(error) };
  }
}

function failureSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "invalid_fault",
    "invalid_reason",
    "match_not_found",
    "terminal_state",
    "not_shipped"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));
  if (reason) return reason;
  if (error.message.includes("invalid input syntax for type uuid")) return "match_not_found";

  return "persistence_unavailable";
}

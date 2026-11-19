import {
  SupabaseRepositoryError,
  parseMatchTransitionCommand,
  transitionMatchWithSupabaseRpc,
  type MatchState,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    matchId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { matchId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const command = parseMatchTransitionCommand(request.headers, {
    matchId,
    nextState:
      typeof body === "object" && body && !Array.isArray(body)
        ? (body as Record<string, unknown>).nextState
        : undefined
  });

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "matches.transition";
  const rateLimit = await enforceRouteRateLimit({
    actorId: actor.userId,
    endpointId,
    policy: "strict"
  });
  if (rateLimit) return rateLimit;

  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: {
      matchId: command.command.matchId,
      nextState: command.command.nextState
    }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await transitionPersistentMatch(supabase, command.command.matchId, command.command.nextState)
      : repository.matches.transition(command.command.matchId, command.command.nextState, actor);

  if (!result.ok) {
    const status = statusForTransitionError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

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

function statusForTransitionError(reason: string): 401 | 402 | 403 | 404 | 409 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "match_not_found") return 404;
  if (reason === "actor_not_allowed" || reason === "step_up_required" || reason === "org_not_verified") {
    return 403;
  }
  if (reason === "match_quota_exceeded") return 402;
  if (reason === "terminal_state" || reason === "invalid_transition" || reason === "already_shipped") return 409;
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function transitionPersistentMatch(
  supabase: SupabaseRestConfig,
  matchId: string,
  nextState: MatchState
) {
  try {
    return await transitionMatchWithSupabaseRpc(supabase, { matchId, nextState });
  } catch (error) {
    return { ok: false as const, reason: transitionSupabaseErrorReason(error) };
  }
}

function transitionSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "match_not_found",
    "terminal_state",
    "invalid_transition",
    "already_shipped",
    "match_quota_exceeded",
    "step_up_required",
    "org_not_verified"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));
  if (reason) return reason;

  // A non-uuid match id never exists in the Supabase runtime.
  if (error.message.includes("invalid input syntax for type uuid")) return "match_not_found";

  return "persistence_unavailable";
}

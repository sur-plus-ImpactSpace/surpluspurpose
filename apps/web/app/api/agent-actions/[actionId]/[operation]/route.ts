import {
  performAgentActionWithSupabaseRpc,
  parseAgentActionCommand,
  SupabaseRepositoryError,
  type ActorContext,
  type AgentActionOperation,
  type SupabaseRestConfig,
  type SurplusRepository
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    actionId: string;
    operation: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const command = parseAgentActionCommand(request.headers, params);

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;

  const endpointId = `agentActions.${command.command.operation}`;
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
      actionId: command.command.actionId,
      operation: command.command.operation
    }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await executePersistentAgentAction(supabase, command.command.operation, command.command.actionId)
      : executeAgentAction(repository, command.command.operation, command.command.actionId, actor);
  if (!result.ok) {
    const status = statusForAgentActionError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    action: result.action,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "agent_action",
    resourceId: result.action.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function executeAgentAction(
  repository: SurplusRepository,
  operation: AgentActionOperation,
  actionId: string,
  actor: ActorContext
) {
  if (operation === "approve") return repository.proposedActions.approve(actionId, actor);
  if (operation === "reject") return repository.proposedActions.reject(actionId, actor);

  return repository.proposedActions.execute(actionId, actor);
}

async function executePersistentAgentAction(
  supabase: SupabaseRestConfig,
  operation: AgentActionOperation,
  actionId: string
) {
  try {
    return await performAgentActionWithSupabaseRpc(supabase, operation, actionId);
  } catch (error) {
    return { ok: false as const, reason: agentActionSupabaseErrorReason(error) };
  }
}

function statusForAgentActionError(reason: string): 403 | 404 | 409 | 422 | 503 {
  if (reason === "actor_not_allowed") return 403;
  if (reason === "action_not_found") return 404;
  if (reason === "approval_required" || reason === "invalid_transition") return 409;
  if (reason === "agent_action_unavailable") return 503;

  return 422;
}

function agentActionSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "agent_action_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "action_not_found",
    "actor_not_allowed",
    "invalid_transition",
    "approval_required",
    "invalid_operation"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));

  return reason ?? "agent_action_unavailable";
}

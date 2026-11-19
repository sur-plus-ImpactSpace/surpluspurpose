import {
  createAgentRunWithSupabaseRpc,
  SupabaseRepositoryError,
  parseAgentRunCommand,
  type AgentRunInput,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../_lib/idempotency";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../_lib/route-workspace";

export const dynamic = "force-dynamic";
const endpointId = "agentRuns.create";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseAgentRunCommand(request.headers, body);

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;

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
    body: command.command.input
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await createPersistentAgentRun(supabase, command.command.input)
      : repository.agentRuns.create(actor, command.command.input);
  if (!result.ok) {
    const status = statusForAgentRunError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    run: result.run,
    actions: result.actions,
    document: result.document,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };

  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "agent_run",
    resourceId: result.run.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

async function createPersistentAgentRun(
  supabase: SupabaseRestConfig,
  input: AgentRunInput
) {
  try {
    return await createAgentRunWithSupabaseRpc(supabase, input);
  } catch (error) {
    return { ok: false as const, reason: agentRunSupabaseErrorReason(error) };
  }
}

function statusForAgentRunError(reason: string): 402 | 403 | 422 | 503 {
  if (reason === "plan_required") return 402;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "agent_run_unavailable") return 503;

  return 422;
}

function agentRunSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "agent_run_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "invalid_task",
    "invalid_target",
    "plan_required",
    "actor_not_allowed"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));

  return reason ?? "agent_run_unavailable";
}

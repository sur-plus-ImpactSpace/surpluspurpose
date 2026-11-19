import {
  createMessageWithSupabaseRpc,
  parseMessageCommand,
  SupabaseRepositoryError,
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

export async function GET(request: NextRequest, context: RouteContext) {
  const { matchId } = await context.params;
  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime } = workspaceDecision.workspace;
  const rateLimit = await enforceRouteRateLimit({
    actorId: actor.userId,
    endpointId: "messages.list",
    policy: "read"
  });
  if (rateLimit) return rateLimit;

  return routeJson(
    {
      messages: repository.messages.listForMatch(matchId, actor),
      runtime: runtime === "supabase" ? "supabase-rest" : "preview-route-handler"
    },
    200
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { matchId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const command = parseMessageCommand(request.headers, {
    matchId,
    body: typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>).body : undefined
  });

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "messages.create";
  const rateLimit = await enforceRouteRateLimit({
    actorId: actor.userId,
    endpointId,
    policy: "mutation"
  });
  if (rateLimit) return rateLimit;

  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: {
      matchId: command.command.matchId,
      body: command.command.body
    }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await createPersistentMessage(supabase, command.command.matchId, command.command.body)
      : repository.messages.create(command.command.matchId, command.command.body, actor);
  if (!result.ok) {
    const status = statusForMessageError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    message: result.message,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "message",
    resourceId: result.message.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

async function createPersistentMessage(
  supabase: SupabaseRestConfig,
  matchId: string,
  body: string
) {
  try {
    return await createMessageWithSupabaseRpc(supabase, { matchId, body });
  } catch (error) {
    return { ok: false as const, reason: messageSupabaseErrorReason(error) };
  }
}

function statusForMessageError(reason: string): 403 | 404 | 413 | 422 | 503 {
  if (reason === "actor_not_allowed") return 403;
  if (reason === "match_not_found") return 404;
  if (reason === "body_too_long") return 413;
  if (reason === "message_unavailable") return 503;

  return 422;
}

function messageSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "message_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "empty_body",
    "body_too_long"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));

  return reason ?? "message_unavailable";
}

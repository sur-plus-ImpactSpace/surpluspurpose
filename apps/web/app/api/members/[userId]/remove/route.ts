import {
  SupabaseRepositoryError,
  parseMemberRemovalCommand,
  removeCompanyMemberWithSupabaseRpc,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ userId: string }> };

/** A company member removes a colleague of the same company; the seat is free again. */
export async function POST(request: NextRequest, context: RouteContext) {
  const { userId } = await context.params;
  const command = parseMemberRemovalCommand(request.headers, userId);
  if (!command.ok) return routeJson({ error: command.reason }, command.status);

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "members.remove";
  const rateLimit = await enforceRouteRateLimit({ actorId: actor.userId, endpointId, policy: "strict" });
  if (rateLimit) return rateLimit;

  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: { userId: command.command.userId }
  });
  if (idempotency.kind === "response") return idempotency.response;

  const result =
    runtime === "supabase"
      ? await removePersistentMember(supabase, command.command.userId)
      : repository.users.removeFromCompany(actor, command.command.userId);

  if (!result.ok) {
    const status = statusForRemovalError(result.reason);
    await idempotency.complete({ responseStatus: status, responseBody: { error: result.reason } });

    return routeJson({ error: result.reason }, status);
  }

  const response = { idempotencyKey: command.command.idempotencyKey, removed: command.command.userId, runtime };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "user",
    resourceId: command.command.userId
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function statusForRemovalError(reason: string): 401 | 403 | 404 | 409 | 503 {
  if (reason === "auth_required") return 401;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "member_not_found") return 404;
  if (reason === "cannot_remove_self") return 409;

  return 503;
}

async function removePersistentMember(supabase: SupabaseRestConfig, userId: string) {
  try {
    return await removeCompanyMemberWithSupabaseRpc(supabase, { userId });
  } catch (error) {
    if (!(error instanceof SupabaseRepositoryError)) return { ok: false as const, reason: "persistence_unavailable" };
    const reason = ["auth_required", "actor_not_allowed", "cannot_remove_self", "member_not_found"].find((item) =>
      error.message.includes(item)
    );
    if (reason) return { ok: false as const, reason };
    if (error.message.includes("invalid input syntax for type uuid")) return { ok: false as const, reason: "member_not_found" };

    return { ok: false as const, reason: "persistence_unavailable" };
  }
}

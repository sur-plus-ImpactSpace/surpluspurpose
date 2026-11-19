import {
  SupabaseRepositoryError,
  parseCo2FactorCommand,
  setCo2FactorWithSupabaseRpc,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../_lib/idempotency";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../_lib/route-workspace";

export const dynamic = "force-dynamic";

/** Ops-only: set the kg CO2e avoided per kg of goods for a category. Audited with old and new value (ADR 0028 D6). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseCo2FactorCommand(request.headers, body);
  if (!command.ok) return routeJson({ error: command.reason }, command.status);

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "co2Factors.set";
  const rateLimit = await enforceRouteRateLimit({ actorId: actor.userId, endpointId, policy: "strict" });
  if (rateLimit) return rateLimit;

  const input = { category: command.command.category, kgCo2ePerKg: command.command.kgCo2ePerKg };
  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: input
  });
  if (idempotency.kind === "response") return idempotency.response;

  const result =
    runtime === "supabase" ? await setPersistentFactor(supabase, input) : repository.co2Factors.set(actor, input);

  if (!result.ok) {
    const status = statusForFactorError(result.reason);
    await idempotency.complete({ responseStatus: status, responseBody: { error: result.reason } });

    return routeJson({ error: result.reason }, status);
  }

  const response = { idempotencyKey: command.command.idempotencyKey, category: input.category, kgCo2ePerKg: input.kgCo2ePerKg, runtime };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "co2_factor",
    resourceId: input.category
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function statusForFactorError(reason: string): 401 | 403 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "invalid_category" || reason === "invalid_factor") return 422;

  return 503;
}

async function setPersistentFactor(supabase: SupabaseRestConfig, input: { category: string; kgCo2ePerKg: number }) {
  try {
    return await setCo2FactorWithSupabaseRpc(supabase, input);
  } catch (error) {
    if (!(error instanceof SupabaseRepositoryError)) return { ok: false as const, reason: "persistence_unavailable" };
    const reason = ["auth_required", "actor_not_available", "actor_not_allowed", "invalid_category", "invalid_factor"].find((item) =>
      error.message.includes(item)
    );

    return { ok: false as const, reason: reason ?? "persistence_unavailable" };
  }
}

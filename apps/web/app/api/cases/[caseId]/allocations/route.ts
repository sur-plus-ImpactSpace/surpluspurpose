import {
  SupabaseRepositoryError,
  createDonationAllocationWithSupabaseRpc,
  parseDonationAllocationCreateCommand,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await context.params;
  const body = await request.json().catch(() => null);
  const command = parseDonationAllocationCreateCommand(request.headers, caseId, body);
  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "donationAllocations.create";
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
      caseId: command.command.caseId,
      ...command.command.input
    }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await createPersistentAllocation(supabase, command.command.caseId, command.command.input)
      : repository.donationAllocations.create(
          actor,
          command.command.caseId,
          command.command.input
        );

  if (!result.ok) {
    const status = statusForCreateError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    allocation: result.allocation,
    position: result.position,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "donation_allocation",
    resourceId: result.allocation.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

function statusForCreateError(reason: string): 401 | 403 | 404 | 409 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (
    reason === "actor_not_allowed" ||
    reason === "company_not_verified" ||
    reason === "ngo_not_verified"
  ) {
    return 403;
  }
  if (
    reason === "case_not_found" ||
    reason === "position_not_found" ||
    reason === "ngo_not_found"
  ) {
    return 404;
  }
  if (reason === "quantity_exceeds_available") return 409;
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function createPersistentAllocation(
  supabase: SupabaseRestConfig,
  caseId: string,
  input: { positionId: string; ngoId: string; quantity: number }
) {
  try {
    return await createDonationAllocationWithSupabaseRpc(supabase, caseId, input);
  } catch (error) {
    return { ok: false as const, reason: createSupabaseErrorReason(error) };
  }
}

function createSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "company_not_verified",
    "case_not_found",
    "case_not_confirmed",
    "position_not_found",
    "position_not_allocatable",
    "ngo_not_found",
    "ngo_not_verified",
    "invalid_quantity",
    "quantity_exceeds_available"
  ];

  return knownReasons.find((item) => error.message.includes(item)) ?? "persistence_unavailable";
}

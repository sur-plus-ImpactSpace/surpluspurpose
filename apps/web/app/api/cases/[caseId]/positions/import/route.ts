import {
  SupabaseRepositoryError,
  importDonationPositionsWithSupabaseRpc,
  parseDonationPositionImportCommand,
  type DonationPositionCreateInput,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> }
) {
  const { caseId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const command = parseDonationPositionImportCommand(request.headers, caseId, body);
  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "donationPositions.import";
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
    body: { caseId: command.command.caseId, positions: command.command.positions }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await importPersistentPositions(supabase, command.command.caseId, command.command.positions)
      : repository.donationCases.importPositions(
          actor,
          command.command.caseId,
          command.command.positions
        );

  if (!result.ok) {
    const status = statusForImportError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    positions: result.positions,
    donationCase: result.donationCase,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "donation_case",
    resourceId: result.donationCase.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

function statusForImportError(reason: string): 401 | 403 | 404 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "actor_not_allowed" || reason === "company_not_verified") return 403;
  if (reason === "case_not_found") return 404;
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function importPersistentPositions(
  supabase: SupabaseRestConfig,
  caseId: string,
  inputs: DonationPositionCreateInput[]
) {
  try {
    return await importDonationPositionsWithSupabaseRpc(supabase, caseId, inputs);
  } catch (error) {
    return { ok: false as const, reason: importSupabaseErrorReason(error) };
  }
}

function importSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "company_not_verified",
    "case_not_found",
    "invalid_payload",
    "empty_positions",
    "too_many_positions",
    "invalid_category",
    "invalid_model",
    "invalid_quantity",
    "invalid_condition",
    "invalid_provenance"
  ];

  return knownReasons.find((item) => error.message.includes(item)) ?? "persistence_unavailable";
}

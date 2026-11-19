import {
  SupabaseRepositoryError,
  confirmDonationCaseWithSupabaseRpc,
  parseDonationCaseConfirmCommand,
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
  const command = parseDonationCaseConfirmCommand(request.headers, caseId);
  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "donationCases.confirm";
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
    body: { caseId: command.command.caseId }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await confirmPersistentCase(supabase, command.command.caseId)
      : repository.donationCases.confirm(actor, command.command.caseId);

  if (!result.ok) {
    const status = statusForConfirmError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    donationCase: result.donationCase,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "donation_case",
    resourceId: result.donationCase.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function statusForConfirmError(reason: string): 401 | 403 | 404 | 409 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "actor_not_allowed" || reason === "company_not_verified") return 403;
  if (reason === "case_not_found") return 404;
  if (reason === "already_confirmed") return 409;
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function confirmPersistentCase(supabase: SupabaseRestConfig, caseId: string) {
  try {
    return await confirmDonationCaseWithSupabaseRpc(supabase, caseId);
  } catch (error) {
    return { ok: false as const, reason: confirmSupabaseErrorReason(error) };
  }
}

function confirmSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "company_not_verified",
    "case_not_found",
    "already_confirmed",
    "nothing_to_confirm"
  ];

  return knownReasons.find((item) => error.message.includes(item)) ?? "persistence_unavailable";
}

import {
  SupabaseRepositoryError,
  createDonationCaseWithSupabaseRpc,
  parseDonationCaseCommand,
  type DonationCaseCreateInput,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../_lib/idempotency";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../_lib/route-workspace";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseDonationCaseCommand(request.headers, body);
  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "donationCases.create";
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
      ? await createPersistentCase(supabase, command.command.input)
      : repository.donationCases.create(actor, command.command.input);

  if (!result.ok) {
    const status = statusForCaseError(result.reason);
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

function statusForCaseError(reason: string): 401 | 403 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (
    reason === "actor_not_allowed" ||
    reason === "company_required" ||
    reason === "company_not_verified"
  ) {
    return 403;
  }
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function createPersistentCase(supabase: SupabaseRestConfig, input: DonationCaseCreateInput) {
  try {
    return await createDonationCaseWithSupabaseRpc(supabase, input);
  } catch (error) {
    return { ok: false as const, reason: caseSupabaseErrorReason(error) };
  }
}

function caseSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "company_required",
    "company_not_verified",
    "invalid_title",
    "invalid_contact",
    "invalid_location"
  ];

  return knownReasons.find((item) => error.message.includes(item)) ?? "persistence_unavailable";
}

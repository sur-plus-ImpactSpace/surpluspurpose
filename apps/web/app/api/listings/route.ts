import {
  SupabaseRepositoryError,
  createListingWithSupabaseRpc,
  parseListingCommand,
  type ListingCreateInput,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../_lib/idempotency";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../_lib/route-workspace";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseListingCommand(request.headers, body);
  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "listings.create";
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
      ? await createPersistentListing(supabase, command.command.input)
      : repository.listings.create(actor, command.command.input);

  if (!result.ok) {
    const status = statusForListingError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    listing: result.listing,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "listing",
    resourceId: result.listing.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

function statusForListingError(reason: string): 401 | 403 | 422 | 503 {
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

async function createPersistentListing(supabase: SupabaseRestConfig, input: ListingCreateInput) {
  try {
    return await createListingWithSupabaseRpc(supabase, input);
  } catch (error) {
    return { ok: false as const, reason: listingSupabaseErrorReason(error) };
  }
}

function listingSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "company_required",
    "company_not_verified",
    "invalid_title",
    "invalid_category",
    "invalid_quantity",
    "invalid_unit_value",
    "invalid_location",
    "invalid_condition",
    "eligibility_not_confirmed"
  ];

  return knownReasons.find((item) => error.message.includes(item)) ?? "persistence_unavailable";
}

import {
  SupabaseRepositoryError,
  parseMatchProposalCommand,
  proposeMatchWithSupabaseRpc,
  type MatchProposalInput,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../_lib/idempotency";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../_lib/route-workspace";

export const dynamic = "force-dynamic";

/**
 * Ops-only: propose a company listing to an NGO need. The match starts in
 * `proposed`; the NGO and the company confirm it later (ADR 0028 D1). The admin
 * guard lives in the propose_match RPC and the repository, not in the parser.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseMatchProposalCommand(request.headers, body);

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "matches.propose";
  const rateLimit = await enforceRouteRateLimit({
    actorId: actor.userId,
    endpointId,
    policy: "strict"
  });
  if (rateLimit) return rateLimit;

  const input: MatchProposalInput = {
    listingId: command.command.listingId,
    needId: command.command.needId,
    ...(command.command.quantity === undefined ? {} : { quantity: command.command.quantity })
  };
  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: input
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await proposePersistentMatch(supabase, input)
      : repository.matches.propose(actor, input);

  if (!result.ok) {
    const status = statusForProposalError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({ responseStatus: status, responseBody: response });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    match: result.match,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "match",
    resourceId: result.match.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

function statusForProposalError(reason: string): 401 | 403 | 404 | 409 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "company_not_verified" || reason === "ngo_not_verified") return 409;
  if (reason === "listing_not_found" || reason === "need_not_found") return 404;
  if (
    reason === "listing_not_open" ||
    reason === "need_not_open" ||
    reason === "match_exists" ||
    reason === "need_fully_covered" ||
    reason === "quantity_exceeds_open"
  ) {
    return 409;
  }
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function proposePersistentMatch(supabase: SupabaseRestConfig, input: MatchProposalInput) {
  try {
    return await proposeMatchWithSupabaseRpc(supabase, input);
  } catch (error) {
    return { ok: false as const, reason: proposalSupabaseErrorReason(error) };
  }
}

function proposalSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "listing_not_found",
    "need_not_found",
    "company_not_verified",
    "ngo_not_verified",
    "listing_not_open",
    "need_not_open",
    "match_exists",
    "need_fully_covered",
    "quantity_exceeds_open",
    "quantity_exceeds_listing",
    "invalid_quantity"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));
  if (reason) return reason;

  // A non-uuid id never exists in the Supabase runtime.
  if (error.message.includes("invalid input syntax for type uuid")) return "listing_not_found";

  return "persistence_unavailable";
}

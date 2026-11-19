import {
  SupabaseRepositoryError,
  parseNgoVerificationCommand,
  setNgoVerificationWithSupabaseRpc,
  type NgoVerificationAction,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    ngoId: string;
  }>;
};

/**
 * Ops-only NGO verification action (approve / request_info / reject /
 * start_review). Preview-first: the in-memory repository owns the admin guard
 * and state change. On approve for notice-based org types, notice date +
 * assessment period years are required (REQ-NGO-06).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { ngoId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const record =
    typeof body === "object" && body && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined;
  const command = parseNgoVerificationCommand(request.headers, {
    ngoId,
    action: record?.action,
    proofNoticeDate: record?.proofNoticeDate,
    proofAssessmentPeriodYears: record?.proofAssessmentPeriodYears
  });

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "ngos.verification";
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
      ngoId: command.command.ngoId,
      action: command.command.action,
      proofNoticeDate: command.command.proofNoticeDate ?? null,
      proofAssessmentPeriodYears: command.command.proofAssessmentPeriodYears ?? null
    }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const verificationInput = {
    action: command.command.action,
    proofNoticeDate: command.command.proofNoticeDate,
    proofAssessmentPeriodYears: command.command.proofAssessmentPeriodYears
  };

  const result =
    runtime === "supabase"
      ? await setPersistentNgoVerification(supabase, command.command.ngoId, verificationInput)
      : repository.ngos.setVerification(command.command.ngoId, verificationInput, actor);

  if (!result.ok) {
    const status = statusForVerificationError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    ngo: result.ngo,
    runtime: "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "ngo",
    resourceId: result.ngo.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function statusForVerificationError(reason: string): 401 | 403 | 404 | 503 | 422 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "ngo_not_found") return 404;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function setPersistentNgoVerification(
  supabase: SupabaseRestConfig,
  ngoId: string,
  input: {
    action: NgoVerificationAction;
    proofNoticeDate?: string | null;
    proofAssessmentPeriodYears?: number | null;
  }
) {
  try {
    return await setNgoVerificationWithSupabaseRpc(supabase, { ngoId, ...input });
  } catch (error) {
    return { ok: false as const, reason: verificationSupabaseErrorReason(error) };
  }
}

function verificationSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "actor_not_allowed",
    "ngo_not_found",
    "invalid_action",
    "verification_document_required",
    "proof_validity_required",
    "invalid_proof_notice_date",
    "invalid_proof_assessment_period"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));
  if (reason) return reason;

  // A non-uuid ngo id never exists in the Supabase runtime.
  if (error.message.includes("invalid input syntax for type uuid")) return "ngo_not_found";

  return "persistence_unavailable";
}

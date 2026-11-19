import type { NgoVerificationState } from "./model";

export const NGO_VERIFICATION_IDEMPOTENCY_HEADER = "idempotency-key";

/**
 * Ops actions on an NGO application. Each maps to a target verification state.
 * `approve` verifies (and stamps `verifiedAt`); `request_info` sends the
 * application back to the applicant for more detail; `reject` closes it;
 * `start_review` moves it into active review.
 */
export const NGO_VERIFICATION_ACTIONS = ["approve", "request_info", "reject", "start_review"] as const;
export type NgoVerificationAction = (typeof NGO_VERIFICATION_ACTIONS)[number];

export const NGO_VERIFICATION_ACTION_TARGET: Record<NgoVerificationAction, NgoVerificationState> = {
  approve: "verified",
  request_info: "pending_info",
  reject: "rejected",
  start_review: "review"
};

export type NgoVerificationHeaderReader = {
  get(name: string): string | null;
};

export type NgoVerificationCommand = {
  idempotencyKey: string;
  ngoId: string;
  action: NgoVerificationAction;
  /** REQ-NGO-06 · required on approve for notice-based org types (business rule in repo/RPC). */
  proofNoticeDate?: string | null;
  proofAssessmentPeriodYears?: number | null;
};

export type NgoVerificationCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_ngo_id"
  | "invalid_payload"
  | "invalid_action"
  | "invalid_proof_notice_date"
  | "invalid_proof_assessment_period";

export type NgoVerificationCommandResult =
  | { ok: true; command: NgoVerificationCommand }
  | { ok: false; reason: NgoVerificationCommandErrorReason; status: 400 | 422 | 428 };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate an Ops actor's intent to move an NGO application to a new state.
 *
 * Pure input validation only — it does NOT decide whether the actor is allowed
 * to verify (that admin guard lives in `repository.ngos.setVerification`, so one
 * place owns the authorization). Proof notice fields are shape-checked here;
 * whether they are mandatory for the org type is a repository / RPC concern.
 */
export function parseNgoVerificationCommand(
  headers: NgoVerificationHeaderReader,
  input: {
    ngoId: unknown;
    action: unknown;
    proofNoticeDate?: unknown;
    proofAssessmentPeriodYears?: unknown;
  }
): NgoVerificationCommandResult {
  const idempotencyKey = headers.get(NGO_VERIFICATION_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof input.ngoId !== "string" || !input.ngoId.trim()) {
    return { ok: false, reason: "invalid_ngo_id", status: 400 };
  }
  if (typeof input.action !== "string") {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const action = input.action.trim();
  if (!NGO_VERIFICATION_ACTIONS.includes(action as NgoVerificationAction)) {
    return { ok: false, reason: "invalid_action", status: 422 };
  }

  let proofNoticeDate: string | null | undefined;
  if (input.proofNoticeDate !== undefined && input.proofNoticeDate !== null) {
    if (typeof input.proofNoticeDate !== "string" || !ISO_DATE.test(input.proofNoticeDate.trim())) {
      return { ok: false, reason: "invalid_proof_notice_date", status: 422 };
    }
    proofNoticeDate = input.proofNoticeDate.trim();
  } else if (input.proofNoticeDate === null) {
    proofNoticeDate = null;
  }

  let proofAssessmentPeriodYears: number | null | undefined;
  if (input.proofAssessmentPeriodYears !== undefined && input.proofAssessmentPeriodYears !== null) {
    const years =
      typeof input.proofAssessmentPeriodYears === "number"
        ? input.proofAssessmentPeriodYears
        : typeof input.proofAssessmentPeriodYears === "string"
          ? Number(input.proofAssessmentPeriodYears)
          : NaN;
    if (!Number.isInteger(years) || years < 1 || years > 20) {
      return { ok: false, reason: "invalid_proof_assessment_period", status: 422 };
    }
    proofAssessmentPeriodYears = years;
  } else if (input.proofAssessmentPeriodYears === null) {
    proofAssessmentPeriodYears = null;
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      ngoId: input.ngoId.trim(),
      action: action as NgoVerificationAction,
      ...(proofNoticeDate !== undefined ? { proofNoticeDate } : {}),
      ...(proofAssessmentPeriodYears !== undefined ? { proofAssessmentPeriodYears } : {})
    }
  };
}

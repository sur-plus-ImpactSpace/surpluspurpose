export const MATCH_FAILURE_IDEMPOTENCY_HEADER = "idempotency-key";

export type MatchFailureHeaderReader = {
  get(name: string): string | null;
};

export type MatchFailureCommand = {
  idempotencyKey: string;
  matchId: string;
  ngoAtFault: boolean;
  reason?: string;
};

export type MatchFailureCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_match_id"
  | "invalid_payload"
  | "invalid_fault"
  | "invalid_reason";

export type MatchFailureCommandResult =
  | { ok: true; command: MatchFailureCommand }
  | { ok: false; reason: MatchFailureCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate "this match failed after shipping". The fault decision is mandatory
 * because it decides the quota refund (ADR 0028 D4). Pure shape check: the
 * admin guard and the state rule live in fail_match / repository.matches.fail.
 */
export function parseMatchFailureCommand(
  headers: MatchFailureHeaderReader,
  matchId: unknown,
  body: unknown
): MatchFailureCommandResult {
  const idempotencyKey = headers.get(MATCH_FAILURE_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) return { ok: false, reason: "missing_idempotency_key", status: 428 };
  if (typeof matchId !== "string" || !matchId.trim()) return { ok: false, reason: "invalid_match_id", status: 400 };
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const { ngoAtFault, reason } = body as Record<string, unknown>;
  if (typeof ngoAtFault !== "boolean") return { ok: false, reason: "invalid_fault", status: 422 };
  if (reason !== undefined && reason !== null && (typeof reason !== "string" || reason.length > 500)) {
    return { ok: false, reason: "invalid_reason", status: 422 };
  }
  const trimmed = typeof reason === "string" ? reason.trim() : "";

  return {
    ok: true,
    command: {
      idempotencyKey,
      matchId: matchId.trim(),
      ngoAtFault,
      ...(trimmed ? { reason: trimmed } : {})
    }
  };
}

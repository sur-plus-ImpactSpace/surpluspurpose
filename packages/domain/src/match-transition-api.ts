import { MATCH_STATES, type MatchState } from "./model";

export const MATCH_TRANSITION_IDEMPOTENCY_HEADER = "idempotency-key";

export type MatchTransitionHeaderReader = {
  get(name: string): string | null;
};

export type MatchTransitionCommand = {
  idempotencyKey: string;
  matchId: string;
  nextState: MatchState;
};

export type MatchTransitionCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_match_id"
  | "invalid_payload"
  | "invalid_next_state";

export type MatchTransitionCommandResult =
  | { ok: true; command: MatchTransitionCommand }
  | { ok: false; reason: MatchTransitionCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate an actor's intent to advance a match to a target state.
 *
 * Pure input validation only — it does NOT decide whether the transition is
 * allowed for this actor or match. That authorization (actor guard, quota,
 * contact unlock) stays in `repository.matches.transition` so there is one
 * place that owns the match state machine.
 */
export function parseMatchTransitionCommand(
  headers: MatchTransitionHeaderReader,
  input: {
    matchId: unknown;
    nextState: unknown;
  }
): MatchTransitionCommandResult {
  const idempotencyKey = headers.get(MATCH_TRANSITION_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof input.matchId !== "string" || !input.matchId.trim()) {
    return { ok: false, reason: "invalid_match_id", status: 400 };
  }
  if (typeof input.nextState !== "string") {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const nextState = input.nextState.trim();
  if (!MATCH_STATES.includes(nextState as MatchState)) {
    return { ok: false, reason: "invalid_next_state", status: 422 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      matchId: input.matchId.trim(),
      nextState: nextState as MatchState
    }
  };
}

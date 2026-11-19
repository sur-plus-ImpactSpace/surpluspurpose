import { describe, expect, it } from "vitest";
import {
  MATCH_TRANSITION_IDEMPOTENCY_HEADER,
  parseMatchTransitionCommand,
  type MatchTransitionHeaderReader
} from "./match-transition-api";

function headers(idempotencyKey: string | null): MatchTransitionHeaderReader {
  return {
    get: (name) => (name === MATCH_TRANSITION_IDEMPOTENCY_HEADER ? idempotencyKey : null)
  };
}

describe("parseMatchTransitionCommand", () => {
  it("accepts a valid transition and trims values", () => {
    const result = parseMatchTransitionCommand(headers("key-1"), {
      matchId: "  mat-1  ",
      nextState: "both_confirmed"
    });

    expect(result).toEqual({
      ok: true,
      command: { idempotencyKey: "key-1", matchId: "mat-1", nextState: "both_confirmed" }
    });
  });

  it("requires an idempotency key", () => {
    const result = parseMatchTransitionCommand(headers(null), {
      matchId: "mat-1",
      nextState: "both_confirmed"
    });
    expect(result).toEqual({ ok: false, reason: "missing_idempotency_key", status: 428 });
  });

  it("rejects an empty or non-string match id", () => {
    expect(parseMatchTransitionCommand(headers("key-1"), { matchId: "  ", nextState: "both_confirmed" })).toEqual({
      ok: false,
      reason: "invalid_match_id",
      status: 400
    });
    expect(parseMatchTransitionCommand(headers("key-1"), { matchId: 42, nextState: "both_confirmed" })).toEqual({
      ok: false,
      reason: "invalid_match_id",
      status: 400
    });
  });

  it("rejects a non-string next state", () => {
    expect(parseMatchTransitionCommand(headers("key-1"), { matchId: "mat-1", nextState: 3 })).toEqual({
      ok: false,
      reason: "invalid_payload",
      status: 400
    });
  });

  it("rejects a next state outside the match state machine", () => {
    expect(parseMatchTransitionCommand(headers("key-1"), { matchId: "mat-1", nextState: "shipped" })).toEqual({
      ok: false,
      reason: "invalid_next_state",
      status: 422
    });
  });
});

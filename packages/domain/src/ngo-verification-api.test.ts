import { describe, expect, it } from "vitest";
import {
  NGO_VERIFICATION_ACTION_TARGET,
  parseNgoVerificationCommand
} from "./ngo-verification-api";

function headers(entries: Record<string, string>) {
  return {
    get: (name: string) => entries[name.toLowerCase()] ?? null
  };
}

describe("parseNgoVerificationCommand", () => {
  it("accepts a valid action with an idempotency key", () => {
    const result = parseNgoVerificationCommand(headers({ "idempotency-key": "abc" }), {
      ngoId: "ngo-1",
      action: "approve"
    });
    expect(result).toEqual({
      ok: true,
      command: { idempotencyKey: "abc", ngoId: "ngo-1", action: "approve" }
    });
  });

  it("rejects a missing idempotency key with 428", () => {
    const result = parseNgoVerificationCommand(headers({}), { ngoId: "ngo-1", action: "approve" });
    expect(result).toEqual({ ok: false, reason: "missing_idempotency_key", status: 428 });
  });

  it("rejects an empty ngo id with 400", () => {
    const result = parseNgoVerificationCommand(headers({ "idempotency-key": "abc" }), {
      ngoId: "  ",
      action: "approve"
    });
    expect(result).toEqual({ ok: false, reason: "invalid_ngo_id", status: 400 });
  });

  it("rejects an unknown action with 422", () => {
    const result = parseNgoVerificationCommand(headers({ "idempotency-key": "abc" }), {
      ngoId: "ngo-1",
      action: "delete"
    });
    expect(result).toEqual({ ok: false, reason: "invalid_action", status: 422 });
  });

  it("maps each action to its verification target", () => {
    expect(NGO_VERIFICATION_ACTION_TARGET).toEqual({
      approve: "verified",
      request_info: "pending_info",
      reject: "rejected",
      start_review: "review"
    });
  });

  it("accepts proof notice fields on approve", () => {
    const result = parseNgoVerificationCommand(headers({ "idempotency-key": "abc" }), {
      ngoId: "ngo-1",
      action: "approve",
      proofNoticeDate: "2024-01-15",
      proofAssessmentPeriodYears: 5
    });
    expect(result).toEqual({
      ok: true,
      command: {
        idempotencyKey: "abc",
        ngoId: "ngo-1",
        action: "approve",
        proofNoticeDate: "2024-01-15",
        proofAssessmentPeriodYears: 5
      }
    });
  });

  it("rejects a bad proof notice date", () => {
    const result = parseNgoVerificationCommand(headers({ "idempotency-key": "abc" }), {
      ngoId: "ngo-1",
      action: "approve",
      proofNoticeDate: "15.01.2024"
    });
    expect(result).toEqual({ ok: false, reason: "invalid_proof_notice_date", status: 422 });
  });
});

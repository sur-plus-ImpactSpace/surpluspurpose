import { describe, expect, it } from "vitest";
import { parseMatchProposalCommand } from "./match-proposal-api";

function headers(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));

  return { get: (name: string) => map.get(name) ?? null };
}

const withKey = headers({ "idempotency-key": "k1" });

describe("parseMatchProposalCommand", () => {
  it("requires an idempotency key", () => {
    expect(parseMatchProposalCommand(headers(), { listingId: "l", needId: "n" })).toMatchObject({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("rejects a non-object payload", () => {
    expect(parseMatchProposalCommand(withKey, null)).toMatchObject({ reason: "invalid_payload", status: 400 });
    expect(parseMatchProposalCommand(withKey, [])).toMatchObject({ reason: "invalid_payload" });
  });

  it("requires a listing id and a need id", () => {
    expect(parseMatchProposalCommand(withKey, { needId: "n" })).toMatchObject({
      reason: "invalid_listing_id",
      status: 422
    });
    expect(parseMatchProposalCommand(withKey, { listingId: "l", needId: " " })).toMatchObject({
      reason: "invalid_need_id",
      status: 422
    });
  });

  it("accepts an optional positive whole quantity", () => {
    expect(parseMatchProposalCommand(withKey, { listingId: "l", needId: "n", quantity: 40 })).toMatchObject({
      ok: true,
      command: { quantity: 40 }
    });
    for (const quantity of [0, -3, 2.5, "40", true]) {
      expect(parseMatchProposalCommand(withKey, { listingId: "l", needId: "n", quantity })).toMatchObject({
        reason: "invalid_quantity",
        status: 422
      });
    }
  });

  it("normalizes a valid command", () => {
    expect(parseMatchProposalCommand(withKey, { listingId: " l1 ", needId: "n1" })).toEqual({
      ok: true,
      command: { idempotencyKey: "k1", listingId: "l1", needId: "n1" }
    });
  });
});

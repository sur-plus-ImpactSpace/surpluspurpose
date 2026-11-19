import { describe, expect, it } from "vitest";
import { parseMatchFailureCommand } from "./match-failure-api";
import { createInMemoryRepository, createSeedData, type ActorContext } from "./repository";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const corporate: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };

const headers = (values: Record<string, string> = { "idempotency-key": "k" }) => ({
  get: (name: string) => values[name] ?? null
});

/** mat-jackets (co-hanse, committed) moved to a shipped state. */
function shipped(state: "in_transit" | "delivered") {
  const data = createSeedData();
  const match = data.matches.find((item) => item.id === "mat-jackets");
  if (match) match.state = state;

  return createInMemoryRepository(data);
}

describe("repository.matches.fail", () => {
  it("fails a shipped match, refunds the quota unit and audits both facts", () => {
    const repo = shipped("in_transit");
    expect(repo.companies.countCommittedMatches("co-hanse", 2026)).toBe(1);

    const result = repo.matches.fail(admin, "mat-jackets", { ngoAtFault: false, reason: "lost" });

    expect(result).toMatchObject({ ok: true, match: { state: "failed" } });
    expect(repo.matches.get("mat-jackets")?.quotaRefundedAt).not.toBeNull();
    expect(repo.companies.countCommittedMatches("co-hanse", 2026)).toBe(0);
    expect(repo.auditEvents.list().map((event) => event.action)).toEqual(
      expect.arrayContaining(["match.failed", "match.failure_assessed:quota_refunded"])
    );
  });

  it("keeps the unit used when the NGO is at fault", () => {
    const repo = shipped("delivered");
    repo.matches.fail(admin, "mat-jackets", { ngoAtFault: true });

    expect(repo.matches.get("mat-jackets")?.quotaRefundedAt).toBeNull();
    expect(repo.companies.countCommittedMatches("co-hanse", 2026)).toBe(1);
  });

  it("is Ops only and needs a shipped, live match", () => {
    expect(shipped("in_transit").matches.fail(corporate, "mat-jackets", { ngoAtFault: false })).toMatchObject({
      reason: "actor_not_allowed"
    });
    // mat-jackets is both_confirmed in the seed: not shipped yet.
    expect(createInMemoryRepository().matches.fail(admin, "mat-jackets", { ngoAtFault: false })).toMatchObject({
      reason: "not_shipped"
    });
    expect(createInMemoryRepository().matches.fail(admin, "nope", { ngoAtFault: false })).toMatchObject({
      reason: "match_not_found"
    });
    const repo = shipped("in_transit");
    repo.matches.fail(admin, "mat-jackets", { ngoAtFault: false });
    expect(repo.matches.fail(admin, "mat-jackets", { ngoAtFault: false })).toMatchObject({
      reason: "terminal_state"
    });
  });
});

describe("cancelled vs failed", () => {
  it("cancels before shipping and the unit stays used", () => {
    const repo = createInMemoryRepository();
    expect(repo.companies.countCommittedMatches("co-hanse", 2026)).toBe(1);

    expect(repo.matches.transition("mat-jackets", "cancelled", admin)).toMatchObject({ ok: true });
    expect(repo.companies.countCommittedMatches("co-hanse", 2026)).toBe(1);
  });

  it("does not cancel once the goods are on their way", () => {
    expect(shipped("in_transit").matches.transition("mat-jackets", "cancelled", admin)).toMatchObject({
      ok: false,
      reason: "already_shipped"
    });
  });

  it("stamps the quota unit when a match is confirmed by both sides", () => {
    const data = createSeedData();
    const match = data.matches.find((item) => item.id === "mat-thinkpads");
    if (match) match.state = "ngo_confirmed";
    const repo = createInMemoryRepository(data);

    repo.matches.transition("mat-thinkpads", "both_confirmed", corporate);

    expect(repo.matches.get("mat-thinkpads")?.committedAt).not.toBeNull();
  });
});

describe("parseMatchFailureCommand", () => {
  it("requires a key, an object and a boolean fault decision", () => {
    expect(parseMatchFailureCommand(headers({}), "m", { ngoAtFault: true })).toMatchObject({ status: 428 });
    expect(parseMatchFailureCommand(headers(), "m", null)).toMatchObject({ reason: "invalid_payload" });
    expect(parseMatchFailureCommand(headers(), "m", {})).toMatchObject({ reason: "invalid_fault" });
    expect(parseMatchFailureCommand(headers(), "m", { ngoAtFault: "no" })).toMatchObject({ reason: "invalid_fault" });
    expect(parseMatchFailureCommand(headers(), "m", { ngoAtFault: true, reason: "x".repeat(501) })).toMatchObject({
      reason: "invalid_reason"
    });
  });

  it("normalizes a valid command", () => {
    expect(parseMatchFailureCommand(headers(), " m1 ", { ngoAtFault: false, reason: " lost " })).toEqual({
      ok: true,
      command: { idempotencyKey: "k", matchId: "m1", ngoAtFault: false, reason: "lost" }
    });
  });
});

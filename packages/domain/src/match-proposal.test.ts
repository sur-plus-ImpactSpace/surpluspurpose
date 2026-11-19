import { describe, expect, it } from "vitest";
import { createInMemoryRepository, type ActorContext } from "./repository";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const corporate: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

const pair = { listingId: "lst-standing-desks", needId: "need-study-desks" };

describe("repository.matches.propose", () => {
  it("creates a proposed match, parks the listing and audits it", () => {
    const repo = createInMemoryRepository();
    const result = repo.matches.propose(admin, pair);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.match).toMatchObject({ ...pair, state: "proposed" });
    expect(repo.matches.get(result.match.id)).toBeDefined();
    expect(repo.listings.get(pair.listingId)?.state).toBe("match_pending");
    // The need only turns "matched" once the NGO confirms.
    expect(repo.needs.get(pair.needId)?.state).toBe("open");
    expect(repo.auditEvents.list()[0]).toMatchObject({ action: "match.proposed", target: result.match.id });
  });

  it("is Ops only", () => {
    const repo = createInMemoryRepository();
    expect(repo.matches.propose(corporate, pair)).toMatchObject({ ok: false, reason: "actor_not_allowed" });
    expect(repo.matches.propose(ngo, pair)).toMatchObject({ ok: false, reason: "actor_not_allowed" });
  });

  it("needs an existing, open listing and need", () => {
    const repo = createInMemoryRepository();
    expect(repo.matches.propose(admin, { ...pair, listingId: "nope" })).toMatchObject({
      reason: "listing_not_found"
    });
    expect(repo.matches.propose(admin, { ...pair, needId: "nope" })).toMatchObject({ reason: "need_not_found" });
    // lst-thinkpads is already match_pending, need-jackets is already matched.
    expect(repo.matches.propose(admin, { ...pair, listingId: "lst-thinkpads" })).toMatchObject({
      reason: "listing_not_open"
    });
    expect(repo.matches.propose(admin, { ...pair, needId: "need-jackets" })).toMatchObject({
      reason: "need_not_open"
    });
  });

  it("does not propose the same pair twice and does not consume quota", () => {
    const repo = createInMemoryRepository();
    const before = repo.companies.countCommittedMatches("co-acme", 2026);

    expect(repo.matches.propose(admin, pair).ok).toBe(true);
    // The listing is now match_pending, so the second try is rejected as taken.
    expect(repo.matches.propose(admin, pair)).toMatchObject({ ok: false, reason: "listing_not_open" });
    expect(repo.companies.countCommittedMatches("co-acme", 2026)).toBe(before);
  });
});

describe("repository.matches.expireStale", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const proposedAt = "2026-06-01T09:00:00.000Z"; // seed: mat-thinkpads
  const at = (days: number) => new Date(Date.parse(proposedAt) + days * DAY).toISOString();

  it("leaves a proposal alone until it is 14 days old", () => {
    const repo = createInMemoryRepository();

    expect(repo.matches.expireStale(at(13.9))).toEqual([]);
    expect(repo.matches.get("mat-thinkpads")?.state).toBe("proposed");
  });

  it("expires an unanswered proposal, releases the listing and audits it", () => {
    const repo = createInMemoryRepository();
    const expired = repo.matches.expireStale(at(14));

    expect(expired.map((match) => match.id)).toEqual(["mat-thinkpads"]);
    expect(repo.matches.get("mat-thinkpads")?.state).toBe("expired");
    expect(repo.listings.get("lst-thinkpads")?.state).toBe("open");
    expect(repo.auditEvents.list()[0]).toMatchObject({
      actor: "system",
      action: "match.expired",
      target: "mat-thinkpads"
    });
    expect(repo.matches.expireStale(at(30))).toEqual([]);
  });

  it("never touches a match somebody reacted to", () => {
    const repo = createInMemoryRepository();
    repo.matches.expireStale(at(365));

    expect(repo.matches.get("mat-jackets")?.state).toBe("both_confirmed");
  });

  it("uses no quota and ends the match for good", () => {
    const repo = createInMemoryRepository();
    const before = repo.companies.countCommittedMatches("co-acme", 2026);
    repo.matches.expireStale(at(14));

    expect(repo.companies.countCommittedMatches("co-acme", 2026)).toBe(before);
    expect(repo.matches.transition("mat-thinkpads", "cancelled", admin)).toMatchObject({
      ok: false,
      reason: "terminal_state"
    });
    expect(repo.matches.transition("mat-thinkpads", "ngo_confirmed", ngo)).toMatchObject({
      ok: false,
      reason: "terminal_state"
    });
  });

  it("lets Ops propose the same pair again after an expiry", () => {
    const repo = createInMemoryRepository();
    repo.matches.expireStale(at(14));

    const result = repo.matches.propose(admin, { listingId: "lst-thinkpads", needId: "need-laptops" });
    expect(result).toMatchObject({ ok: true, match: { state: "proposed" } });
  });

  it("honours max quantity per match on the need (REQ-NGO-05)", () => {
    const repo = createInMemoryRepository();
    const need = repo.needs.get("need-study-desks");
    if (!need) throw new Error("seed changed");
    need.maxQuantityPerMatch = 5;

    expect(
      repo.matches.propose(admin, { listingId: "lst-standing-desks", needId: "need-study-desks", quantity: 8 })
    ).toMatchObject({ ok: false, reason: "quantity_exceeds_max_per_match" });

    expect(
      repo.matches.propose(admin, { listingId: "lst-standing-desks", needId: "need-study-desks" })
    ).toMatchObject({ ok: true, match: { quantity: 5 } });
  });
});

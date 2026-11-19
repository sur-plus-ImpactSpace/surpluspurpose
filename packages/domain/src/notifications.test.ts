import { describe, expect, it } from "vitest";
import { createInMemoryRepository, createSeedData, type ActorContext } from "./repository";

const DAY = 24 * 60 * 60 * 1000;
const proposedAt = Date.parse("2026-06-01T09:00:00.000Z"); // seed mat-thinkpads
const at = (days: number) => new Date(proposedAt + days * DAY).toISOString();

const corporate: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

describe("proposal expiry warning", () => {
  it("stays quiet until three days before expiry", () => {
    const repo = createInMemoryRepository(createSeedData());

    expect(repo.matches.warnExpiring(at(10.9))).toEqual([]);
    expect(repo.notifications.list(corporate)).toEqual([]);
  });

  it("reminds both sides of a proposal that is about to expire", () => {
    const repo = createInMemoryRepository(createSeedData());

    expect(repo.matches.warnExpiring(at(11)).map((match) => match.id)).toEqual(["mat-thinkpads"]);
    expect(repo.notifications.list(corporate)).toMatchObject([{ kind: "proposal_expiring", matchId: "mat-thinkpads" }]);
    expect(repo.notifications.list(ngo)).toMatchObject([{ kind: "proposal_expiring", matchId: "mat-thinkpads" }]);
  });

  it("warns once, however often the job runs", () => {
    const repo = createInMemoryRepository(createSeedData());
    repo.matches.warnExpiring(at(11));
    repo.matches.warnExpiring(at(12));

    expect(repo.notifications.list(corporate)).toHaveLength(1);
  });

  it("does not warn about an expired or confirmed match", () => {
    const repo = createInMemoryRepository(createSeedData());

    expect(repo.matches.warnExpiring(at(14))).toEqual([]); // already past the 14 days
    expect(repo.notifications.list(corporate)).toEqual([]);
  });

  it("keeps notifications private to their owner", () => {
    const repo = createInMemoryRepository(createSeedData());
    repo.matches.warnExpiring(at(11));

    expect(repo.notifications.list({ role: "admin", userId: "usr-admin-ops" })).toEqual([]);
  });
});

describe("status change notifications", () => {
  const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };

  it("tells both sides when Ops proposes a match", () => {
    const repo = createInMemoryRepository(createSeedData());
    repo.matches.propose(admin, { listingId: "lst-standing-desks", needId: "need-study-desks" });

    expect(repo.notifications.list(corporate)[0]).toMatchObject({ kind: "match_status", title: "A match was proposed" });
    expect(repo.notifications.list(ngo)[0]).toMatchObject({ kind: "match_status", title: "A match was proposed" });
  });

  it("tells both sides at every step of the confirmed lifecycle", () => {
    const repo = createInMemoryRepository(createSeedData());
    repo.matches.transition("mat-thinkpads", "ngo_confirmed", ngo);

    expect(repo.notifications.list(corporate)).toMatchObject([
      { matchId: "mat-thinkpads", title: "The NGO confirmed the match" }
    ]);
    expect(repo.notifications.list(ngo)).toHaveLength(1);
  });

  it("covers cancellation, failure and expiry", () => {
    const repo = createInMemoryRepository(createSeedData());
    repo.matches.transition("mat-jackets", "cancelled", admin);
    repo.matches.expireStale("2027-01-01T00:00:00.000Z");

    const titles = repo.notifications.list(ngo).map((item) => item.title);
    expect(titles).toEqual(expect.arrayContaining(["The match was cancelled", "The proposal expired"]));
  });

  it("does not notify when a transition is refused", () => {
    const repo = createInMemoryRepository(createSeedData());
    repo.matches.transition("mat-thinkpads", "completed", ngo);

    expect(repo.notifications.list(ngo)).toEqual([]);
  });
});

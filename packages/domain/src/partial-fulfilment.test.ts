import { describe, expect, it } from "vitest";
import { needOpenQuantity } from "./model";
import { createInMemoryRepository, createSeedData, type ActorContext, type RepositoryData } from "./repository";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

/** need-study-desks wants 24; three companies each offer a few desks. */
function seed(): RepositoryData {
  const data = createSeedData();
  const template = data.listings.find((listing) => listing.id === "lst-standing-desks");
  if (!template) throw new Error("seed changed");
  for (const [id, companyId, quantity] of [
    ["lst-desks-b", "co-hanse", 10],
    ["lst-desks-c", "co-hanse", 30],
    ["lst-desks-d", "co-hanse", 5]
  ] as const) {
    data.listings.push({ ...template, id, companyId, quantity, state: "open" });
  }

  return data;
}

const NEED = "need-study-desks";

describe("filling one need in parts", () => {
  it("counts the open quantity down with every proposal", () => {
    const repo = createInMemoryRepository(seed());
    expect(needOpenQuantity(repo.needs.get(NEED)!, repo.snapshot().matches)).toBe(24);

    const first = repo.matches.propose(admin, { listingId: "lst-desks-b", needId: NEED });
    expect(first).toMatchObject({ ok: true, match: { quantity: 10 } });
    expect(needOpenQuantity(repo.needs.get(NEED)!, repo.snapshot().matches)).toBe(14);
  });

  it("caps a default part at what the need still wants", () => {
    const repo = createInMemoryRepository(seed());
    repo.matches.propose(admin, { listingId: "lst-desks-b", needId: NEED });

    // lst-desks-c has 30, but only 14 are open.
    expect(repo.matches.propose(admin, { listingId: "lst-desks-c", needId: NEED })).toMatchObject({
      ok: true,
      match: { quantity: 14 }
    });
  });

  it("refuses to over-book the need", () => {
    const repo = createInMemoryRepository(seed());
    repo.matches.propose(admin, { listingId: "lst-desks-b", needId: NEED });

    expect(repo.matches.propose(admin, { listingId: "lst-desks-c", needId: NEED, quantity: 15 })).toMatchObject({
      ok: false,
      reason: "quantity_exceeds_open"
    });

    repo.matches.propose(admin, { listingId: "lst-desks-c", needId: NEED });
    expect(repo.matches.propose(admin, { listingId: "lst-desks-d", needId: NEED })).toMatchObject({
      ok: false,
      reason: "need_fully_covered"
    });
  });

  it("validates an explicit part", () => {
    const repo = createInMemoryRepository(seed());

    expect(repo.matches.propose(admin, { listingId: "lst-desks-d", needId: NEED, quantity: 0 })).toMatchObject({
      reason: "invalid_quantity"
    });
    expect(repo.matches.propose(admin, { listingId: "lst-desks-d", needId: NEED, quantity: 2.5 })).toMatchObject({
      reason: "invalid_quantity"
    });
    expect(repo.matches.propose(admin, { listingId: "lst-desks-d", needId: NEED, quantity: 6 })).toMatchObject({
      reason: "quantity_exceeds_listing"
    });
  });

  it("keeps a part-filled need open and marks it matched once the parts add up", () => {
    const repo = createInMemoryRepository(seed());
    const first = repo.matches.propose(admin, { listingId: "lst-desks-b", needId: NEED });
    const second = repo.matches.propose(admin, { listingId: "lst-desks-c", needId: NEED });
    if (!first.ok || !second.ok) throw new Error("proposals failed");

    repo.matches.transition(first.match.id, "ngo_confirmed", ngo);
    expect(repo.needs.get(NEED)?.state).toBe("open");

    repo.matches.transition(second.match.id, "ngo_confirmed", ngo);
    expect(repo.needs.get(NEED)?.state).toBe("matched");
  });

  it("fulfils the need only when the completed parts cover it", () => {
    const data = seed();
    const repo = createInMemoryRepository(data);
    const first = repo.matches.propose(admin, { listingId: "lst-desks-b", needId: NEED });
    const second = repo.matches.propose(admin, { listingId: "lst-desks-c", needId: NEED });
    if (!first.ok || !second.ok) throw new Error("proposals failed");
    for (const match of [first.match, second.match]) {
      repo.matches.transition(match.id, "ngo_confirmed", ngo);
      match.state = "delivered";
    }

    repo.matches.transition(first.match.id, "completed", ngo);
    expect(repo.needs.get(NEED)?.state).toBe("matched");

    repo.matches.transition(second.match.id, "completed", ngo);
    expect(repo.needs.get(NEED)?.state).toBe("fulfilled");
  });

  it("gives a cancelled part back and reopens the need", () => {
    const repo = createInMemoryRepository(seed());
    const first = repo.matches.propose(admin, { listingId: "lst-desks-b", needId: NEED });
    const second = repo.matches.propose(admin, { listingId: "lst-desks-c", needId: NEED });
    if (!first.ok || !second.ok) throw new Error("proposals failed");
    repo.matches.transition(first.match.id, "ngo_confirmed", ngo);
    repo.matches.transition(second.match.id, "ngo_confirmed", ngo);
    expect(repo.needs.get(NEED)?.state).toBe("matched");

    repo.matches.transition(second.match.id, "cancelled", admin);

    expect(needOpenQuantity(repo.needs.get(NEED)!, repo.snapshot().matches)).toBe(14);
    expect(repo.needs.get(NEED)?.state).toBe("open");
  });

  it("gives an expired proposal's part back", () => {
    const repo = createInMemoryRepository(seed());
    const first = repo.matches.propose(admin, { listingId: "lst-desks-b", needId: NEED });
    if (!first.ok) throw new Error("proposal failed");
    expect(needOpenQuantity(repo.needs.get(NEED)!, repo.snapshot().matches)).toBe(14);

    repo.matches.expireStale("2027-01-01T00:00:00.000Z");

    expect(needOpenQuantity(repo.needs.get(NEED)!, repo.snapshot().matches)).toBe(24);
  });

  it("has no remainder to guard for a need that names no quantity", () => {
    const data = seed();
    const need = data.needs.find((item) => item.id === NEED);
    if (need) need.quantity = null;
    const repo = createInMemoryRepository(data);

    expect(needOpenQuantity(repo.needs.get(NEED)!, repo.snapshot().matches)).toBeNull();
    expect(repo.matches.propose(admin, { listingId: "lst-desks-c", needId: NEED })).toMatchObject({
      ok: true,
      match: { quantity: 30 }
    });
  });
});

describe("needOpenQuantity", () => {
  const need = { id: "n1", quantity: 100 };

  it("subtracts live parts only", () => {
    const matches = [
      { needId: "n1", state: "proposed", quantity: 20 },
      { needId: "n1", state: "completed", quantity: 30 },
      { needId: "n1", state: "cancelled", quantity: 40 },
      { needId: "n1", state: "expired", quantity: 5 },
      { needId: "n2", state: "proposed", quantity: 99 }
    ] as const;

    expect(needOpenQuantity(need, matches)).toBe(50);
  });

  it("never goes below zero", () => {
    expect(needOpenQuantity(need, [{ needId: "n1", state: "proposed", quantity: 150 }])).toBe(0);
  });
});

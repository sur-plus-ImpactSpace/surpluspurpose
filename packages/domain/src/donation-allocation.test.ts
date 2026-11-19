import { describe, expect, it } from "vitest";
import {
  parseDonationAllocationCreateCommand,
  parseDonationAllocationReleaseCommand
} from "./donation-allocation-api";
import { activeAllocatedQuantity, assertDonationCaseAllocatable } from "./model";
import {
  createInMemoryRepository,
  createSeedData,
  type ActorContext,
  type RepositoryData
} from "./repository";
import { releaseDonationAllocationWithSupabaseRpc } from "./supabase-rest";

const corporate: ActorContext = {
  role: "corporate",
  userId: "usr-corporate-acme",
  companyId: "co-acme"
};

const ngo: ActorContext = {
  role: "ngo",
  userId: "usr-ngo-kleiderkammer",
  ngoId: "ngo-kleiderkammer"
};

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };

function seedWith(change: (data: RepositoryData) => void) {
  const data = createSeedData();
  change(data);
  return createInMemoryRepository(data);
}

function confirmedRepo() {
  const repo = createInMemoryRepository();
  const confirmed = repo.donationCases.confirm(corporate, "case-office-move");
  expect(confirmed.ok).toBe(true);
  return repo;
}

describe("parseDonationAllocationCreateCommand", () => {
  it("requires idempotency key and allocation fields", () => {
    expect(
      parseDonationAllocationCreateCommand({ get: () => null }, "case-1", {
        positionId: "pos-1",
        ngoId: "ngo-1",
        quantity: 2
      })
    ).toMatchObject({ ok: false, reason: "missing_idempotency_key" });

    expect(
      parseDonationAllocationCreateCommand({ get: () => "k1" }, "case-1", {
        positionId: "pos-1",
        ngoId: "ngo-1",
        quantity: 0
      })
    ).toMatchObject({ ok: false, reason: "invalid_quantity" });
  });

  it("accepts a valid create payload", () => {
    expect(
      parseDonationAllocationCreateCommand({ get: () => "k1" }, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 10
      })
    ).toMatchObject({
      ok: true,
      command: {
        caseId: "case-office-move",
        input: { positionId: "pos-office-laptops", ngoId: "ngo-kleiderkammer", quantity: 10 }
      }
    });
  });
});

describe("parseDonationAllocationReleaseCommand", () => {
  it("requires a written release note", () => {
    expect(
      parseDonationAllocationReleaseCommand({ get: () => "k1" }, "alloc-1", { releaseNote: "  " })
    ).toMatchObject({ ok: false, reason: "invalid_release_note" });
    expect(
      parseDonationAllocationReleaseCommand({ get: () => "k1" }, "alloc-1", {
        releaseNote: "Cannot store these units"
      })
    ).toMatchObject({
      ok: true,
      command: { allocationId: "alloc-1", input: { releaseNote: "Cannot store these units" } }
    });
  });
});

describe("repository.donationAllocations", () => {
  it("refuses allocation before the confirmation gate", () => {
    const repo = createInMemoryRepository();
    expect(assertDonationCaseAllocatable(repo.donationCases.get("case-office-move"))).toEqual({
      ok: false,
      reason: "case_not_confirmed"
    });
    expect(
      repo.donationAllocations.create(admin, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 5
      })
    ).toMatchObject({ ok: false, reason: "case_not_confirmed" });
  });

  it("creates an allocation binding position + NGO + quantity", () => {
    const repo = confirmedRepo();
    const created = repo.donationAllocations.create(admin, "case-office-move", {
      positionId: "pos-office-laptops",
      ngoId: "ngo-kleiderkammer",
      quantity: 10
    });
    expect(created).toMatchObject({
      ok: true,
      allocation: {
        positionId: "pos-office-laptops",
        caseId: "case-office-move",
        ngoId: "ngo-kleiderkammer",
        quantity: 10,
        state: "active",
        // Label snapshot (0071): NGO reads names without position/case RLS.
        positionModel: "Lenovo ThinkPad L14 Gen 3",
        caseTitle: "Munich office move — Q2 surplus"
      },
      position: { state: "allocated" }
    });
    if (!created.ok) return;
    expect(repo.donationAllocations.listForCase("case-office-move")).toHaveLength(1);
    expect(repo.donationAllocations.listForNgo("ngo-kleiderkammer")[0]?.id).toBe(created.allocation.id);
    expect(
      repo.snapshot().auditEvents.some((event) => event.action === "donation_allocation.created")
    ).toBe(true);
  });

  it("enforces sum(active qty) ≤ confirmed position quantity", () => {
    const repo = confirmedRepo();
    expect(
      repo.donationAllocations.create(admin, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 30
      }).ok
    ).toBe(true);
    expect(
      repo.donationAllocations.create(admin, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 11
      })
    ).toMatchObject({ ok: false, reason: "quantity_exceeds_available" });

    const exact = repo.donationAllocations.create(admin, "case-office-move", {
      positionId: "pos-office-laptops",
      ngoId: "ngo-kleiderkammer",
      quantity: 10
    });
    expect(exact.ok).toBe(true);
    expect(activeAllocatedQuantity(repo.donationAllocations.listForCase("case-office-move"), "pos-office-laptops")).toBe(
      40
    );
  });

  it("lets the NGO release in writing and returns quantity to the pool", () => {
    const repo = confirmedRepo();
    const created = repo.donationAllocations.create(admin, "case-office-move", {
      positionId: "pos-office-laptops",
      ngoId: "ngo-kleiderkammer",
      quantity: 15
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      repo.donationAllocations.release(corporate, created.allocation.id, {
        releaseNote: "corporate cannot release"
      })
    ).toMatchObject({ ok: false, reason: "actor_not_allowed" });

    const released = repo.donationAllocations.release(ngo, created.allocation.id, {
      releaseNote: "No warehouse capacity this month"
    });
    expect(released).toMatchObject({
      ok: true,
      allocation: {
        state: "released",
        releaseNote: "No warehouse capacity this month",
        releasedAt: expect.any(String)
      },
      position: { state: "confirmed" }
    });
    expect(
      activeAllocatedQuantity(repo.donationAllocations.listForCase("case-office-move"), "pos-office-laptops")
    ).toBe(0);
    expect(
      repo.donationAllocations.create(admin, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 40
      }).ok
    ).toBe(true);
    expect(
      repo.snapshot().auditEvents.some((event) => event.action === "donation_allocation.released")
    ).toBe(true);
  });

  it("only Ops allocates — the owning company is refused", () => {
    const repo = confirmedRepo();
    expect(
      repo.donationAllocations.create(corporate, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 1
      })
    ).toMatchObject({ ok: false, reason: "actor_not_allowed" });
    expect(
      repo.donationAllocations.create(
        { role: "editor", userId: "usr-editor-ops" },
        "case-office-move",
        { positionId: "pos-office-laptops", ngoId: "ngo-kleiderkammer", quantity: 1 }
      )
    ).toMatchObject({ ok: true });
  });

  it("refuses unverified NGOs and NGO create actors", () => {
    const unverified = seedWith((data) => {
      const target = data.ngos.find((item) => item.id === "ngo-kleiderkammer");
      if (target) target.verificationState = "verification_pending";
    });
    expect(unverified.donationCases.confirm(corporate, "case-office-move").ok).toBe(true);
    expect(
      unverified.donationAllocations.create(admin, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 5
      })
    ).toMatchObject({ ok: false, reason: "ngo_not_verified" });

    const repo = confirmedRepo();
    expect(
      repo.donationAllocations.create(ngo, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 5
      })
    ).toMatchObject({ ok: false, reason: "actor_not_allowed" });
  });
});

describe("repository.donationAllocations hardening (0072)", () => {
  it("refuses allocation on a case of an unverified company", () => {
    const repo = seedWith((data) => {
      const company = data.companies.find((item) => item.id === "co-acme");
      if (company) company.verificationState = "verification_pending";
      const donationCase = data.donationCases.find((item) => item.id === "case-office-move");
      if (donationCase) donationCase.confirmedAt = "2026-06-01T00:00:00.000Z";
      for (const position of data.donationPositions) position.state = "confirmed";
    });

    expect(
      repo.donationAllocations.create(admin, "case-office-move", {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 1
      })
    ).toMatchObject({ ok: false, reason: "company_not_verified" });
  });

  it("re-confirm restores `allocated` for positions that kept active claims", () => {
    const repo = confirmedRepo();
    const created = repo.donationAllocations.create(admin, "case-office-move", {
      positionId: "pos-office-laptops",
      ngoId: "ngo-kleiderkammer",
      quantity: 3
    });
    expect(created.ok).toBe(true);

    const added = repo.donationCases.addPosition(corporate, "case-office-move", {
      category: "Furniture",
      model: "Desk",
      quantity: 2,
      condition: "Good",
      provenance: "Office"
    });
    expect(added.ok).toBe(true);
    expect(repo.donationPositions.get("pos-office-laptops")?.state).toBe("ready");

    expect(repo.donationCases.confirm(corporate, "case-office-move").ok).toBe(true);
    expect(repo.donationPositions.get("pos-office-laptops")?.state).toBe("allocated");
    expect(repo.donationPositions.get("pos-office-chairs")?.state).toBe("confirmed");
  });
});

describe("releaseDonationAllocationWithSupabaseRpc", () => {
  const releasedRow = {
    id: "alloc-uuid",
    position_id: "pos-uuid",
    case_id: "case-uuid",
    ngo_id: "ngo-uuid",
    quantity: 6,
    state: "released",
    position_model: "Laptop",
    case_title: "Laptops",
    release_note: "No storage space",
    released_at: "2026-11-19T07:00:00.000Z",
    created_at: "2026-11-19T06:00:00.000Z"
  };

  function configWith(positionsResponse: () => Response) {
    const fetchImpl: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path === "/rest/v1/rpc/release_donation_allocation") {
        return new Response(JSON.stringify(releasedRow), { status: 200 });
      }
      return positionsResponse();
    };
    return {
      url: "https://example.supabase.co",
      key: "anon-key",
      authorization: "Bearer ngo-jwt",
      fetchImpl
    };
  }

  it("succeeds when the NGO cannot read the position under RLS", async () => {
    const result = await releaseDonationAllocationWithSupabaseRpc(
      configWith(() => new Response("[]", { status: 200 })),
      "alloc-uuid",
      { releaseNote: "No storage space" }
    );

    expect(result).toMatchObject({
      ok: true,
      allocation: {
        id: "alloc-uuid",
        state: "released",
        releaseNote: "No storage space",
        positionModel: "Laptop",
        caseTitle: "Laptops"
      },
      position: null
    });
  });

  it("does not fail a committed release when the position re-read errors", async () => {
    const result = await releaseDonationAllocationWithSupabaseRpc(
      configWith(() => new Response("upstream", { status: 503 })),
      "alloc-uuid",
      { releaseNote: "No storage space" }
    );

    expect(result).toMatchObject({ ok: true, position: null });
  });
});

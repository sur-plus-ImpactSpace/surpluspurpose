import { describe, expect, it } from "vitest";
import {
  parseDonationCaseCommand,
  parseDonationCaseConfirmCommand,
  parseDonationPositionCommand,
  parseDonationPositionImportCommand
} from "./donation-case-api";
import { parseDonationPositionCsv } from "./donation-case-import";
import {
  createInMemoryRepository,
  createSeedData,
  type ActorContext,
  type DonationCaseCreateInput,
  type DonationPositionCreateInput,
  type RepositoryData
} from "./repository";
import {
  assertDonationCaseAllocatable,
  DONATION_CASE_STEP_BY_NUMBER,
  DONATION_POSITION_STATES,
  donationCaseIsConfirmed
} from "./model";

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

function seedWith(change: (data: RepositoryData) => void) {
  const data = createSeedData();
  change(data);
  return createInMemoryRepository(data);
}

function caseInput(overrides: Partial<DonationCaseCreateInput> = {}): DonationCaseCreateInput {
  return {
    title: "Warehouse clear-out",
    contactName: "Lea Weber",
    contactEmail: "lea@example.com",
    city: "Munich",
    country: "Germany",
    timeWindow: "Weekdays 09:00–16:00",
    ...overrides
  };
}

function positionInput(
  overrides: Partial<DonationPositionCreateInput> = {}
): DonationPositionCreateInput {
  return {
    category: "IT & Electronics",
    model: "Dell Latitude 5420",
    quantity: 10,
    condition: "Good",
    provenance: "Refresh cycle 2026",
    ...overrides
  };
}

describe("donation case steps", () => {
  it("names the seven Phase 1 exit steps", () => {
    expect(DONATION_CASE_STEP_BY_NUMBER[1]).toBe("contact");
    expect(DONATION_CASE_STEP_BY_NUMBER[3]).toBe("confirm");
    expect(DONATION_CASE_STEP_BY_NUMBER[7]).toBe("report");
    expect(DONATION_POSITION_STATES).toContain("ready");
  });
});

describe("parseDonationCaseCommand", () => {
  it("requires an idempotency key and contact + location", () => {
    expect(parseDonationCaseCommand({ get: () => null }, caseInput())).toMatchObject({
      ok: false,
      reason: "missing_idempotency_key"
    });
    expect(
      parseDonationCaseCommand(
        { get: () => "k1" },
        { ...caseInput(), contactEmail: "not-an-email" }
      )
    ).toMatchObject({ ok: false, reason: "invalid_contact" });
  });

  it("accepts a valid create payload", () => {
    const result = parseDonationCaseCommand({ get: () => "k1" }, caseInput());
    expect(result).toMatchObject({
      ok: true,
      command: { input: { title: "Warehouse clear-out", city: "Munich" } }
    });
  });
});

describe("parseDonationPositionCommand / import", () => {
  it("validates position fields", () => {
    expect(
      parseDonationPositionCommand({ get: () => "k1" }, "case-1", {
        ...positionInput(),
        quantity: 0
      })
    ).toMatchObject({ ok: false, reason: "invalid_quantity" });
  });

  it("rejects an empty import batch", () => {
    expect(
      parseDonationPositionImportCommand({ get: () => "k1" }, "case-1", { positions: [] })
    ).toMatchObject({ ok: false, reason: "empty_positions" });
  });
});

describe("parseDonationPositionCsv", () => {
  it("maps DE/EN headers into position inputs", () => {
    const csv = [
      "Kategorie,Modell,Menge,Zustand,Herkunft",
      "IT & Electronics,ThinkPad L14,12,Good,Employee refresh",
      "Furniture,Desk,0,Good,Skip me"
    ].join("\n");
    const result = parseDonationPositionCsv(csv);
    expect(result).toEqual({
      ok: true,
      positions: [
        {
          category: "IT & Electronics",
          model: "ThinkPad L14",
          quantity: 12,
          condition: "Good",
          provenance: "Employee refresh"
        }
      ]
    });
  });
});

describe("repository.donationCases", () => {
  it("creates a case at step 1 for a verified corporate", () => {
    const repo = createInMemoryRepository();
    const result = repo.donationCases.create(corporate, caseInput());
    expect(result).toMatchObject({
      ok: true,
      donationCase: { companyId: "co-acme", step: 1, confirmedAt: null }
    });
  });

  it("refuses unverified companies and NGO actors", () => {
    const unverified = seedWith((data) => {
      const company = data.companies.find((item) => item.id === "co-acme");
      if (company) company.verificationState = "onboarding";
    });
    expect(unverified.donationCases.create(corporate, caseInput())).toMatchObject({
      ok: false,
      reason: "company_not_verified"
    });
    expect(createInMemoryRepository().donationCases.create(ngo, caseInput())).toMatchObject({
      ok: false,
      reason: "actor_not_allowed"
    });
  });

  it("adds a position and advances contact → inventory", () => {
    const repo = createInMemoryRepository();
    const created = repo.donationCases.create(corporate, caseInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const added = repo.donationCases.addPosition(corporate, created.donationCase.id, positionInput());
    expect(added).toMatchObject({
      ok: true,
      position: { model: "Dell Latitude 5420", state: "ready" },
      donationCase: { step: 2 }
    });
    expect(repo.donationPositions.listForCase(created.donationCase.id)).toHaveLength(1);
  });

  it("imports many positions onto the seed case", () => {
    const repo = createInMemoryRepository();
    const result = repo.donationCases.importPositions(corporate, "case-office-move", [
      positionInput({ model: "Monitor 24\"" }),
      positionInput({ model: "Keyboard", quantity: 30 })
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.positions).toHaveLength(2);
    expect(repo.donationPositions.listForCase("case-office-move").length).toBeGreaterThanOrEqual(4);
  });

  it("keeps seed referential integrity with the sample case", () => {
    const repo = createInMemoryRepository();
    expect(repo.assertReferentialIntegrity()).toEqual([]);
    expect(repo.donationCases.listForCompany("co-acme")[0]?.title).toContain("office move");
  });

  it("confirms inventory (REQ-CORP-02) and gates allocation", () => {
    const repo = createInMemoryRepository();
    const seed = repo.donationCases.get("case-office-move");
    expect(seed).toBeDefined();
    if (!seed) return;

    expect(donationCaseIsConfirmed(seed)).toBe(false);
    expect(assertDonationCaseAllocatable(seed)).toEqual({
      ok: false,
      reason: "case_not_confirmed"
    });

    const confirmed = repo.donationCases.confirm(corporate, seed.id);
    expect(confirmed).toMatchObject({
      ok: true,
      donationCase: { step: 4, confirmedAt: expect.any(String) }
    });
    if (!confirmed.ok) return;

    expect(donationCaseIsConfirmed(confirmed.donationCase)).toBe(true);
    expect(assertDonationCaseAllocatable(confirmed.donationCase)).toEqual({ ok: true });
    expect(
      repo.donationPositions.listForCase(seed.id).every((item) => item.state === "confirmed")
    ).toBe(true);
    expect(repo.donationCases.confirm(corporate, seed.id)).toMatchObject({
      ok: false,
      reason: "already_confirmed"
    });
  });

  it("reopens confirmation when a position is added after confirm", () => {
    const repo = createInMemoryRepository();
    expect(repo.donationCases.confirm(corporate, "case-office-move").ok).toBe(true);

    const added = repo.donationCases.addPosition(
      corporate,
      "case-office-move",
      positionInput({ model: "Extra monitor" })
    );
    expect(added).toMatchObject({
      ok: true,
      donationCase: { step: 2, confirmedAt: null },
      position: { state: "ready" }
    });
    const positions = repo.donationPositions.listForCase("case-office-move");
    expect(positions.every((item) => item.state === "ready")).toBe(true);
    expect(assertDonationCaseAllocatable(repo.donationCases.get("case-office-move"))).toEqual({
      ok: false,
      reason: "case_not_confirmed"
    });
  });

  it("refuses confirm with no positions", () => {
    const repo = createInMemoryRepository();
    const created = repo.donationCases.create(corporate, caseInput({ title: "Empty case" }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(repo.donationCases.confirm(corporate, created.donationCase.id)).toMatchObject({
      ok: false,
      reason: "nothing_to_confirm"
    });
  });
});

describe("parseDonationCaseConfirmCommand", () => {
  it("requires idempotency key and case id", () => {
    expect(parseDonationCaseConfirmCommand({ get: () => null }, "case-1")).toMatchObject({
      ok: false,
      reason: "missing_idempotency_key"
    });
    expect(parseDonationCaseConfirmCommand({ get: () => "k1" }, "  ")).toMatchObject({
      ok: false,
      reason: "invalid_case_id"
    });
    expect(parseDonationCaseConfirmCommand({ get: () => "k1" }, "case-1")).toMatchObject({
      ok: true,
      command: { caseId: "case-1" }
    });
  });
});

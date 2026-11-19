import { describe, expect, it } from "vitest";
import {
  createInMemoryRepository,
  createSeedData,
  type ActorContext,
  type ListingCreateInput,
  type RepositoryData
} from "./repository";

const corporate: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

function input(overrides: Partial<ListingCreateInput> = {}): ListingCreateInput {
  return {
    title: "Standing desks",
    category: "Office & facility furniture",
    quantity: 12,
    unitValue: 90,
    city: "Munich",
    country: "Germany",
    condition: "Good",
    eligibility: { usable: true, policyFit: true, ownership: true },
    ...overrides
  };
}

function seedWith(change: (data: RepositoryData) => void) {
  const data = createSeedData();
  change(data);
  return createInMemoryRepository(data);
}

describe("repository.listings.create", () => {
  it("creates an open listing for the corporate actor's company", () => {
    const repo = createInMemoryRepository();
    const result = repo.listings.create(corporate, input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.listing).toMatchObject({
      companyId: "co-acme",
      title: "Standing desks",
      state: "open",
      unit: "units"
    });
    expect(repo.listings.listForCompany("co-acme").some((l) => l.id === result.listing.id)).toBe(true);
  });

  it("rejects when eligibility is not fully confirmed", () => {
    const repo = createInMemoryRepository();
    const result = repo.listings.create(
      corporate,
      input({ eligibility: { usable: true, policyFit: false, ownership: true } })
    );
    expect(result).toMatchObject({ ok: false, reason: "eligibility_not_confirmed" });
  });

  it("does not let an NGO actor create listings", () => {
    const repo = createInMemoryRepository();
    const result = repo.listings.create(ngo, input());
    expect(result).toMatchObject({ ok: false, reason: "actor_not_allowed" });
  });

  it("rejects listing create while the company is unverified (ADR 0027)", () => {
    const repo = seedWith((data) => {
      const company = data.companies.find((item) => item.id === "co-acme");
      if (company) company.verificationState = "verification_pending";
    });

    expect(repo.listings.create(corporate, input())).toMatchObject({
      ok: false,
      reason: "company_not_verified"
    });
  });
});

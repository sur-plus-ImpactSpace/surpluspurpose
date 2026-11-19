import { describe, expect, it } from "vitest";
import { isCompanyVerified, isNgoVerified } from "./model";
import { createInMemoryRepository, createSeedData, type ActorContext, type RepositoryData } from "./repository";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const corporate: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

function seedWith(change: (data: RepositoryData) => void) {
  const data = createSeedData();
  change(data);

  return createInMemoryRepository(data);
}

const unverifyCompany = (data: RepositoryData) => {
  const company = data.companies.find((item) => item.id === "co-acme");
  if (company) company.verificationState = "verification_pending";
};
const unverifyNgo = (data: RepositoryData) => {
  const record = data.ngos.find((item) => item.id === "ngo-kleiderkammer");
  if (record) record.verificationState = "review";
};

describe("verification helpers", () => {
  it("count only the verified state, and nothing for an unknown organisation", () => {
    expect(isCompanyVerified({ verificationState: "verified" })).toBe(true);
    expect(isCompanyVerified({ verificationState: "review" })).toBe(false);
    expect(isCompanyVerified({})).toBe(false);
    expect(isCompanyVerified(undefined)).toBe(false);
    expect(isNgoVerified({ verificationState: "verified" })).toBe(true);
    expect(isNgoVerified({ verificationState: "rejected" })).toBe(false);
    expect(isNgoVerified(undefined)).toBe(false);
  });
});

describe("matching needs verified organisations, whatever the plan", () => {
  const pair = { listingId: "lst-standing-desks", needId: "need-study-desks" };

  it("lets Ops propose only between verified organisations", () => {
    expect(seedWith(() => undefined).matches.propose(admin, pair).ok).toBe(true);
    expect(seedWith(unverifyCompany).matches.propose(admin, pair)).toMatchObject({
      ok: false,
      reason: "company_not_verified"
    });
    // need-study-desks belongs to ngo-kleiderkammer in the seed.
    expect(seedWith(unverifyNgo).matches.propose(admin, pair)).toMatchObject({
      ok: false,
      reason: "ngo_not_verified"
    });
  });

  it("keeps the seed's unverified Tree company out of matching", () => {
    const data = createSeedData();
    const nord = data.companies.find((company) => company.id === "co-nord");
    expect(nord?.plan).toBe("tree");
    expect(isCompanyVerified(nord)).toBe(false);
  });

  it("stops an unverified NGO from confirming a proposal", () => {
    const repo = seedWith(unverifyNgo);

    expect(repo.matches.transition("mat-thinkpads", "ngo_confirmed", ngo)).toMatchObject({
      ok: false,
      reason: "org_not_verified"
    });
    expect(repo.matches.get("mat-thinkpads")?.state).toBe("proposed");
  });

  it("stops an unverified company from confirming, even on a paid plan", () => {
    const repo = seedWith((data) => {
      const match = data.matches.find((item) => item.id === "mat-thinkpads");
      if (match) match.state = "ngo_confirmed";
      unverifyCompany(data);
    });

    expect(repo.companies.get("co-acme")?.plan).toBe("seed");
    expect(repo.matches.transition("mat-thinkpads", "both_confirmed", corporate)).toMatchObject({
      ok: false,
      reason: "org_not_verified"
    });
  });

  it("does not gate Ops logistics", () => {
    const repo = seedWith(unverifyCompany);

    expect(repo.matches.transition("mat-jackets", "in_transit", admin).ok).toBe(true);
  });
});

describe("listing create needs a verified company", () => {
  it("blocks an unverified company from listing, even on a paid plan", () => {
    const repo = seedWith((data) => {
      const company = data.companies.find((item) => item.id === "co-acme");
      if (company) {
        company.plan = "tree";
        company.verificationState = "review";
      }
    });

    expect(
      repo.listings.create(corporate, {
        title: "Office chairs",
        category: "Office & facility furniture",
        quantity: 10,
        unitValue: 40,
        city: "Munich",
        country: "Germany",
        condition: "Good",
        eligibility: { usable: true, policyFit: true, ownership: true }
      })
    ).toMatchObject({ ok: false, reason: "company_not_verified" });
  });
});

describe("contact details and documents need verification", () => {
  it("shows the NGO's full profile to a verified corporate after both_confirmed", () => {
    const repo = createInMemoryRepository();
    const hanse: ActorContext = { role: "corporate", userId: "usr-hanse", companyId: "co-hanse" };

    expect(repo.ngos.getForMatch("mat-jackets", hanse)).toHaveProperty("contactEmail");
  });

  it("keeps contact details back from an unverified corporate", () => {
    const repo = seedWith((data) => {
      const company = data.companies.find((item) => item.id === "co-hanse");
      if (company) company.verificationState = "rejected";
    });
    const hanse: ActorContext = { role: "corporate", userId: "usr-hanse", companyId: "co-hanse" };

    expect(repo.ngos.getForMatch("mat-jackets", hanse)).not.toHaveProperty("contactEmail");
  });

  it("hides documents from an unverified organisation but not from Ops", () => {
    const repo = seedWith((data) => {
      unverifyCompany(data);
      unverifyNgo(data);
    });

    expect(repo.documents.list(corporate)).toEqual([]);
    expect(repo.documents.list(ngo)).toEqual([]);
    expect(repo.documents.list(admin).length).toBeGreaterThan(0);
  });

  it("shows documents to verified organisations", () => {
    const repo = createInMemoryRepository();

    expect(repo.documents.list(corporate).length).toBeGreaterThan(0);
  });
});

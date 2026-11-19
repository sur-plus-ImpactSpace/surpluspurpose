import { describe, expect, it } from "vitest";
import { buildImpactReport } from "./impact-report";
import type { Listing, Match, Need, Ngo } from "./model";

function match(overrides: Partial<Match> & Pick<Match, "id" | "listingId" | "needId">): Match {
  return {
    state: "completed",
    quantity: 1,
    committedAt: null,
    quotaRefundedAt: null,
    score: 90,
    co2Tons: 2.5,
    pickupDate: null,
    deliveryDate: null,
    carrier: null,
    trackingRef: null,
    createdAt: "2026-06-01T09:00:00.000Z",
    ...overrides
  };
}

function listing(overrides: Partial<Listing> & Pick<Listing, "id">): Listing {
  return {
    companyId: "co-1",
    title: "Standing desks",
    category: "Office & facility furniture",
    subcategory: null,
    quantity: 10,
    unit: "units",
    unitValue: 100,
    city: "Munich",
    country: "Germany",
    condition: "Good",
    state: "completed",
    availableUntil: null,
    pickupWindow: "Weekdays",
    packaging: "Loose",
    weightKg: 12,
    categoryDetails: "",
    photos: [],
    attachments: [],
    reviewFlags: [],
    eligibility: { usable: true, policyFit: true, ownership: true },
    createdAt: "2026-05-01T09:00:00.000Z",
    ...overrides
  };
}

function need(overrides: Partial<Need> & Pick<Need, "id" | "ngoId">): Need {
  return {
    title: "Need",
    category: "IT",
    subcategory: null,
    quantity: 10,
    quantityOpen: false,
    urgency: "flexible",
    city: "Berlin",
    country: "Germany",
    targetDate: null,
    beneficiaries: 40,
    deliveryPreference: "either",
    maxQuantityPerMatch: null,
    targetGroup: "Learners",
    deliveryAddress: "Main warehouse",
    hasVehicle: false,
    state: "open",
    story: "",
    createdAt: "2026-05-01T09:00:00.000Z",
    ...overrides
  };
}

function ngo(overrides: Partial<Ngo> & Pick<Ngo, "id" | "name" | "country">): Ngo {
  return {
    city: "Berlin",
    focus: "Education",
    verificationState: "verified",
    trustScore: 90,
    boardContact: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    verifiedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("buildImpactReport", () => {
  const listings = [
    listing({ id: "l1", category: "IT Hardware", quantity: 200, unitValue: 71, weightKg: 9 }),
    listing({ id: "l2", category: "Furniture", quantity: 50, unitValue: 90, weightKg: 20 })
  ];
  const needs = [need({ id: "n1", ngoId: "ngo-de" }), need({ id: "n2", ngoId: "ngo-pl" })];
  const ngos = [
    ngo({ id: "ngo-de", name: "Bildung Digital e.V.", country: "DE" }),
    ngo({ id: "ngo-pl", name: "Kleiderkammer Lodz", country: "PL" })
  ];
  const matches = [
    match({ id: "m1", listingId: "l1", needId: "n1", co2Tons: 3.06, createdAt: "2026-05-14T09:00:00.000Z" }),
    match({ id: "m2", listingId: "l2", needId: "n2", co2Tons: 2.64, createdAt: "2026-04-18T09:00:00.000Z" }),
    // Not completed → excluded from audit-grade totals.
    match({ id: "m3", listingId: "l2", needId: "n1", state: "both_confirmed", co2Tons: 9 })
  ];

  it("aggregates only completed matches into audit-grade totals", () => {
    const report = buildImpactReport({ matches, listings, needs, ngos });
    expect(report.totals.matches).toBe(2);
    expect(report.totals.valueEur).toBe(200 * 71 + 50 * 90); // 14200 + 4500 = 18700
    expect(report.totals.co2Tons).toBe(5.7);
    expect(report.totals.ngos).toBe(2);
    expect(report.totals.countries).toBe(2);
    expect(report.totals.weightKg).toBe(200 * 9 + 50 * 20); // 1800 + 1000 = 2800
  });

  it("breaks down by category, sorted by value", () => {
    const report = buildImpactReport({ matches, listings, needs, ngos });
    expect(report.byCategory.map((row) => row.category)).toEqual(["IT Hardware", "Furniture"]);
    expect(report.byCategory[0]).toMatchObject({ units: 200, valueEur: 14200, co2Tons: 3.06 });
  });

  it("lists beneficiaries newest-first and geographic reach", () => {
    const report = buildImpactReport({ matches, listings, needs, ngos });
    expect(report.beneficiaries.map((row) => row.ngoName)).toEqual([
      "Bildung Digital e.V.",
      "Kleiderkammer Lodz"
    ]);
    expect(report.geoReach.map((row) => row.country)).toEqual(["DE", "PL"]);
    expect(report.geoReach[0]).toMatchObject({ country: "DE", ngos: 1, matches: 1, valueEur: 14200 });
  });
});

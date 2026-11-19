import { describe, expect, it } from "vitest";
import { buildMatchImpactSummaries } from "./match-impact";
import type { Document, Listing, Match } from "./model";

function match(overrides: Partial<Match> & Pick<Match, "id" | "listingId">): Match {
  return {
    needId: "need-1",
    state: "proposed",
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
    quantity: 48,
    unit: "units",
    unitValue: 95,
    city: "Munich",
    country: "Germany",
    condition: "Good",
    state: "match_pending",
    availableUntil: null,
    pickupWindow: "Weekdays",
    packaging: "Loose",
    weightKg: 640,
    categoryDetails: "",
    photos: [],
    attachments: [],
    reviewFlags: [],
    eligibility: { usable: true, policyFit: true, ownership: true },
    createdAt: "2026-05-01T09:00:00.000Z",
    ...overrides
  };
}

function document(
  overrides: Partial<Document> & Pick<Document, "id" | "kind" | "matchId" | "status">
): Document {
  return {
    title: "Evidence",
    companyId: "co-1",
    ngoId: null,
    storagePath: null,
    mime: "application/pdf",
    sizeBytes: 1000,
    createdBy: "usr-admin-ops",
    createdAt: "2026-06-04T09:00:00.000Z",
    publishedAt: null,
    ...overrides
  };
}

describe("buildMatchImpactSummaries", () => {
  it("projects real listing figures onto the match", () => {
    const summaries = buildMatchImpactSummaries({
      matches: [match({ id: "mat-1", listingId: "lst-1", co2Tons: 8.6 })],
      listings: [listing({ id: "lst-1", quantity: 200, unit: "units", unitValue: 71 })],
      documents: []
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      matchId: "mat-1",
      headline: "Standing desks",
      category: "Office & facility furniture",
      co2Tons: 8.6,
      quantity: 200,
      unit: "units",
      estimatedValueEur: 14200
    });
  });

  it("marks certificate and CSRD note ready only when approved or published", () => {
    const summaries = buildMatchImpactSummaries({
      matches: [match({ id: "mat-1", listingId: "lst-1" })],
      listings: [listing({ id: "lst-1" })],
      documents: [
        document({ id: "doc-cert", kind: "certificate", matchId: "mat-1", status: "draft" }),
        document({ id: "doc-csrd", kind: "report", matchId: "mat-1", status: "approved" })
      ]
    });

    expect(summaries[0]?.certificate).toEqual({
      status: "in_progress",
      documentId: "doc-cert",
      title: "Evidence"
    });
    expect(summaries[0]?.csrdNote).toMatchObject({ status: "ready", documentId: "doc-csrd" });
  });

  it("prefers a ready document over a newer draft", () => {
    const summaries = buildMatchImpactSummaries({
      matches: [match({ id: "mat-1", listingId: "lst-1" })],
      listings: [listing({ id: "lst-1" })],
      documents: [
        document({
          id: "doc-cert-v1",
          kind: "certificate",
          matchId: "mat-1",
          status: "published",
          createdAt: "2026-06-01T09:00:00.000Z"
        }),
        document({
          id: "doc-cert-v2",
          kind: "certificate",
          matchId: "mat-1",
          status: "draft",
          createdAt: "2026-06-05T09:00:00.000Z"
        })
      ]
    });

    expect(summaries[0]?.certificate).toMatchObject({ status: "ready", documentId: "doc-cert-v1" });
  });

  it("reports pending evidence, tolerates unknown listings and skips cancelled matches", () => {
    const summaries = buildMatchImpactSummaries({
      matches: [
        match({ id: "mat-1", listingId: "lst-missing" }),
        match({ id: "mat-2", listingId: "lst-1", state: "cancelled" })
      ],
      listings: [listing({ id: "lst-1" })],
      documents: []
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      matchId: "mat-1",
      headline: "Surplus match",
      category: null,
      quantity: null,
      unit: null,
      estimatedValueEur: null
    });
    expect(summaries[0]?.certificate.status).toBe("pending");
    expect(summaries[0]?.csrdNote.status).toBe("pending");
  });

  it("sorts newest match first", () => {
    const summaries = buildMatchImpactSummaries({
      matches: [
        match({ id: "mat-old", listingId: "lst-1", createdAt: "2026-06-01T09:00:00.000Z" }),
        match({ id: "mat-new", listingId: "lst-1", createdAt: "2026-06-03T09:00:00.000Z" })
      ],
      listings: [listing({ id: "lst-1" })],
      documents: []
    });

    expect(summaries.map((summary) => summary.matchId)).toEqual(["mat-new", "mat-old"]);
  });
});

import { describe, expect, it } from "vitest";
import { buildImpactReport, impactDate, parseReportPeriod } from "./impact-report";
import type { Listing, Match, Need, Ngo } from "./model";

describe("parseReportPeriod", () => {
  it("treats blank as all time and open ends as open", () => {
    expect(parseReportPeriod(undefined, "")).toEqual({ ok: true, period: null });
    expect(parseReportPeriod("2026-01-01", null)).toEqual({ ok: true, period: { from: "2026-01-01", to: null } });
    expect(parseReportPeriod("2026-01-01", "2026-03-31")).toEqual({ ok: true, period: { from: "2026-01-01", to: "2026-03-31" } });
    expect(parseReportPeriod("2026-03-31", "2026-03-31")).toMatchObject({ ok: true });
  });

  it("refuses malformed dates and an end before the start", () => {
    for (const [from, to] of [["01.01.2026", null], ["2026-13-01", null], ["2026-02-30x", null], ["2026-04-01", "2026-03-01"]] as const) {
      expect(parseReportPeriod(from, to), `${from} ${to}`).toEqual({ ok: false, reason: "invalid_period" });
    }
  });
});

describe("buildImpactReport period", () => {
  const listing = { id: "l1", title: "Laptops", category: "IT", quantity: 10, unitValue: 100, weightKg: 2 } as Listing;
  const need = { id: "n1", ngoId: "g1" } as Need;
  const ngo = { id: "g1", name: "Helpers e.V.", country: "DE" } as Ngo;
  const match = (id: string, deliveryDate: string | null, createdAt: string): Match =>
    ({ id, listingId: "l1", needId: "n1", state: "completed", quantity: 10, co2Tons: 1.5, deliveryDate, createdAt }) as Match;
  const matches = [
    match("m-jan", "2026-01-15", "2025-12-20T00:00:00.000Z"),
    match("m-mar", "2026-03-10", "2026-03-01T00:00:00.000Z"),
    match("m-nodate", null, "2026-06-05T00:00:00.000Z")
  ];
  const report = (period: Parameters<typeof buildImpactReport>[0]["period"]) =>
    buildImpactReport({ matches, listings: [listing], needs: [need], ngos: [ngo], period });

  it("dates a donation by delivery, else by when the match began", () => {
    expect(impactDate(matches[0]!)).toBe("2026-01-15");
    expect(impactDate(matches[2]!)).toBe("2026-06-05");
  });

  it("counts every donation without a period", () => {
    expect(report(null).totals.matches).toBe(3);
    expect(report(null).period).toBeNull();
  });

  it("counts only donations inside the period, ends included", () => {
    expect(report({ from: "2026-01-01", to: "2026-03-31" }).beneficiaries.map((row) => row.matchId).sort()).toEqual(["m-jan", "m-mar"]);
    expect(report({ from: "2026-01-15", to: "2026-01-15" }).totals.matches).toBe(1);
    expect(report({ from: "2026-04-01", to: null }).beneficiaries.map((row) => row.matchId)).toEqual(["m-nodate"]);
    expect(report({ from: null, to: "2026-02-01" }).totals.matches).toBe(1);
    expect(report({ from: "2027-01-01", to: null }).totals.matches).toBe(0);
  });

  it("lists every donation with its own figures", () => {
    const row = report(null).beneficiaries.find((item) => item.matchId === "m-mar");
    expect(row).toMatchObject({ title: "Laptops", units: 10, weightKg: 20, valueEur: 1000, co2Tons: 1.5, ngoName: "Helpers e.V." });
    expect(report({ from: "2026-01-01", to: "2026-03-31" }).totals).toMatchObject({ matches: 2, valueEur: 2000, co2Tons: 3 });
  });
});

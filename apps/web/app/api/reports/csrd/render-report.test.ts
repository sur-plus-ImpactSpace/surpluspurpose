import type { ImpactReport } from "@surplus/domain";
import { describe, expect, it } from "vitest";
import { renderCsrdReportCsv, renderCsrdReportHtml } from "./render-report";

const report: ImpactReport = {
  period: { from: "2026-01-01", to: "2026-03-31" },
  totals: { valueEur: 2000, co2Tons: 3, matches: 2, ngos: 1, countries: 1, weightKg: 40 },
  byCategory: [{ category: "IT", units: 20, weightKg: 40, valueEur: 2000, co2Tons: 3 }],
  geoReach: [{ country: "DE", ngos: 1, matches: 2, valueEur: 2000 }],
  beneficiaries: [
    { matchId: "m1", date: "2026-03-10", ngoName: "<script>alert(1)</script> e.V.", country: "DE", category: "IT", valueEur: 1000, title: "=HYPERLINK(\"x\")", units: 10, weightKg: 20, co2Tons: 1.5 },
    { matchId: "m2", date: "2026-01-15", ngoName: "Helpers, e.V.", country: "DE", category: "IT", valueEur: 1000, title: "Laptops", units: 10, weightKg: 20, co2Tons: 1.5 }
  ]
};

describe("renderCsrdReportHtml", () => {
  const html = renderCsrdReportHtml(report, { companyName: "Acme <b>GmbH</b>", generatedAt: "2026-04-01T10:00:00.000Z" });

  it("covers the ESRS sections, the period and every donation", () => {
    for (const text of ["Key metrics", "E5 ·", "E1 ·", "S3 ·", "2026-01-01 to 2026-03-31", "All donations in the period", "m1", "m2", "€2,000"]) {
      expect(html).toContain(text);
    }
  });

  it("escapes user content (company and NGO names)", () => {
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Acme &lt;b&gt;GmbH&lt;/b&gt;");
  });

  it("labels an unbounded report as all time", () => {
    expect(renderCsrdReportHtml({ ...report, period: null }, { companyName: "A", generatedAt: "2026-04-01T00:00:00.000Z" })).toContain("all time");
  });
});

describe("renderCsrdReportCsv", () => {
  const csv = renderCsrdReportCsv(report);
  const lines = csv.trim().split("\n");

  it("has a header and one row per donation", () => {
    expect(lines[0]).toBe("date,match_id,goods,category,units,weight_kg,value_eur,co2e_tons,ngo,country");
    expect(lines).toHaveLength(3);
  });

  it("quotes commas and neutralises spreadsheet formulas", () => {
    expect(csv).toContain('"Helpers, e.V."');
    expect(lines[1]).toContain("'=HYPERLINK");
    expect(lines[1]).not.toContain(",=HYPERLINK");
  });
});

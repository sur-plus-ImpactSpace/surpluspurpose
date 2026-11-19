import { describe, expect, it } from "vitest";
import { buildCertificateRenderData } from "./certificate-data";
import { createSeedData } from "./repository";

function seedInputs(documentId: string) {
  const data = createSeedData();
  const document = data.documents.find((item) => item.id === documentId);
  if (!document) throw new Error(`missing seed document ${documentId}`);
  const match = data.matches.find((item) => item.id === document.matchId);
  const listing = data.listings.find((item) => item.id === match?.listingId);
  const need = data.needs.find((item) => item.id === match?.needId);
  const ngo = data.ngos.find((item) => item.id === need?.ngoId);
  const company = data.companies.find((item) => item.id === listing?.companyId);

  return { document, match, listing, need, ngo, company };
}

describe("buildCertificateRenderData", () => {
  it("blocks rendering before the contact unlock state", () => {
    // Seed certificate hangs on mat-thinkpads which is still `proposed`.
    const result = buildCertificateRenderData(seedInputs("doc-donation-certificate-thinkpads"));
    expect(result).toMatchObject({ ok: false, reason: "document_not_ready" });
  });

  it("renders once the match unlocks contact", () => {
    const inputs = seedInputs("doc-donation-certificate-thinkpads");
    const result = buildCertificateRenderData({
      ...inputs,
      match: { ...inputs.match!, state: "completed" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      kind: "donation_certificate",
      documentTitle: "Donation certificate",
      company: { name: "Acme GmbH" },
      goods: { quantity: 200, unit: "units" },
      impact: { co2Tons: 8.6, estimatedValueEur: 14200, beneficiaries: 180 },
      methodology: { co2: "GHG Protocol", reporting: "ESRS/CSRD" }
    });
    expect(result.data.reference).toMatch(/^SP-CERT-\d{4}-MAT-THINKPADS$/);
    expect(result.data.ngo.name.length).toBeGreaterThan(0);
  });

  it("maps report documents to CSRD notes", () => {
    const inputs = seedInputs("doc-csrd-thinkpads");
    const result = buildCertificateRenderData({
      ...inputs,
      match: { ...inputs.match!, state: "both_confirmed" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.kind).toBe("csrd_note");
    expect(result.data.reference).toMatch(/^SP-CSRD-/);
  });

  it("rejects unsupported kinds and missing match data", () => {
    const inputs = seedInputs("doc-logistics-tracker-thinkpads"); // kind: upload
    expect(buildCertificateRenderData(inputs)).toMatchObject({
      ok: false,
      reason: "unsupported_document_kind"
    });

    const certInputs = seedInputs("doc-donation-certificate-thinkpads");
    expect(buildCertificateRenderData({ ...certInputs, listing: undefined })).toMatchObject({
      ok: false,
      reason: "match_data_missing"
    });
  });
});

import { buildCertificateRenderData, createInMemoryRepository, createSeedData, type CertificateRenderData } from "@surplus/domain";
import { describe, expect, it } from "vitest";
import { renderDocumentHtml } from "./render-document";

/** A real certificate: the seed jackets match walked to completion. */
function certificate(): CertificateRenderData {
  const repo = createInMemoryRepository(createSeedData());
  const admin = { role: "admin", userId: "usr-admin-ops" } as const;
  repo.matches.transition("mat-jackets", "in_transit", admin);
  repo.matches.transition("mat-jackets", "delivered", admin);
  repo.matches.transition("mat-jackets", "completed", { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" });

  const data = repo.snapshot();
  const document = data.documents.find((item) => item.matchId === "mat-jackets" && item.kind === "certificate");
  const match = data.matches.find((item) => item.id === "mat-jackets");
  const listing = data.listings.find((item) => item.id === match?.listingId);
  const need = data.needs.find((item) => item.id === match?.needId);
  const result = buildCertificateRenderData({
    document: document!,
    match,
    listing,
    need,
    ngo: data.ngos.find((item) => item.id === need?.ngoId),
    company: data.companies.find((item) => item.id === listing?.companyId)
  });
  if (!result.ok) throw new Error(`fixture not renderable: ${result.reason}`);

  return result.data;
}

describe("renderDocumentHtml", () => {
  const data = certificate();

  it("keeps the printable certificate with its signature lines and print hint", () => {
    const html = renderDocumentHtml(data);

    expect(html).toContain(data.ngo.name);
    expect(html).toContain("print dialog");
    expect(html).toContain('class="sig"');
    expect(html).not.toContain("signature-field");
    expect(html).not.toContain("${");
  });

  it("produces the DocuSeal version with a signature field per side and no print hint", () => {
    const html = renderDocumentHtml(data, { forSigning: true });

    expect(html).toContain('<signature-field name="Company signature" role="Company"');
    expect(html).toContain('<signature-field name="NGO signature" role="NGO"');
    expect(html).toContain(data.company.name);
    expect(html).not.toContain("print dialog");
    expect(html).not.toContain("${");
  });
});

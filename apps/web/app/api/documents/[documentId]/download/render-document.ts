import type { CertificateRenderData } from "@surplus/domain";
import { categoryLabel } from "../../../../lib/catalog";

/**
 * `forSigning` produces the version sent to DocuSeal: the two signature lines
 * become DocuSeal signature fields (roles "Company" and "NGO") and the print hint goes.
 */
export function renderDocumentHtml(data: CertificateRenderData, options: { forSigning?: boolean } = {}): string {
  const e = escapeHtml;
  const isCert = data.kind === "donation_certificate";
  const issued = new Date(data.issuedAt).toISOString().slice(0, 10);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${e(data.documentTitle)} · ${e(data.reference)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1e2a23; margin: 0; background: #f4f2ec; }
  .sheet { max-width: 760px; margin: 24px auto; background: #fff; padding: 56px 64px; border: 1px solid #ddd; }
  .kicker { font-family: system-ui, sans-serif; font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #2f6f4f; }
  h1 { font-size: 28px; margin: 8px 0 2px; font-weight: 600; }
  .ref { font-family: system-ui, sans-serif; font-size: 12px; color: #666; }
  hr { border: 0; border-top: 1px solid #e5e2d9; margin: 24px 0; }
  p { line-height: 1.6; font-size: 15px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 12px 0; }
  th { text-align: left; font-family: system-ui, sans-serif; font-size: 11px; letter-spacing: .1em;
       text-transform: uppercase; color: #888; padding: 8px 0 2px; }
  td { padding: 2px 0 8px; border-bottom: 1px solid #f0ede4; }
  .impact { display: flex; gap: 32px; margin: 20px 0; }
  .impact div { flex: 1; }
  .impact .v { font-size: 24px; font-weight: 600; color: #2f6f4f; }
  .impact .l { font-family: system-ui, sans-serif; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #888; }
  .foot { font-family: system-ui, sans-serif; font-size: 11px; color: #888; line-height: 1.6; }
  .sig { margin-top: 48px; display: flex; gap: 48px; }
  .sig div { flex: 1; border-top: 1px solid #999; padding-top: 6px; font-family: system-ui, sans-serif; font-size: 12px; color: #666; }
  .print-hint { font-family: system-ui, sans-serif; font-size: 12px; color: #888; text-align: center; margin: 12px 0 32px; }
  @media print { body { background: #fff; } .sheet { border: 0; margin: 0; max-width: none; } .print-hint { display: none; } }
</style>
</head>
<body>
<div class="sheet">
  <p class="kicker">sur.plus · Every surplus has a purpose</p>
  <h1>${e(data.documentTitle)}</h1>
  <p class="ref">Reference ${e(data.reference)} · Issued ${e(issued)}</p>
  <hr>
  ${
    isCert
      ? `<p><strong>${e(data.company.name)}</strong> (${e(data.company.city)}, ${e(data.company.country)})
         donated the goods listed below to <strong>${e(data.ngo.name)}</strong>
         (${e(data.ngo.city)}, ${e(data.ngo.country)}), a verified non-profit organization
         focused on ${e(data.ngo.focus)}. The donation was matched, coordinated and
         documented via the sur.plus platform.</p>`
      : `<p>This note documents the circular-economy transaction between
         <strong>${e(data.company.name)}</strong> and <strong>${e(data.ngo.name)}</strong>
         for CSRD/ESRS reporting purposes. Figures below follow the methodologies
         referenced in the footer and trace back to the audited match record.</p>`
  }
  <table>
    <tr><th>Goods</th><th>Category</th><th>Quantity</th><th>Condition</th></tr>
    <tr>
      <td>${e(data.goods.title)}</td>
      <td>${e(categoryLabel(data.goods.category, "de"))}</td>
      <td>${data.goods.quantity} ${e(data.goods.unit)}</td>
      <td>${e(data.goods.condition)}</td>
    </tr>
  </table>
  <div class="impact">
    <div><div class="v">${data.impact.co2Tons}&nbsp;t</div><div class="l">CO2e avoided</div></div>
    <div><div class="v">&euro;${data.impact.estimatedValueEur.toLocaleString("en-US")}</div><div class="l">Estimated value</div></div>
    ${
      data.impact.beneficiaries !== null
        ? `<div><div class="v">${data.impact.beneficiaries}</div><div class="l">People reached</div></div>`
        : ""
    }
  </div>
  <table>
    <tr><th>Pickup</th><th>Delivery</th><th>Match status</th></tr>
    <tr>
      <td>${e(data.logistics.pickupDate ?? "—")}</td>
      <td>${e(data.logistics.deliveryDate ?? "—")}</td>
      <td>${e(data.logistics.matchState.replace(/_/g, " "))}</td>
    </tr>
  </table>
  ${
    isCert && data.ngo.authorization
      ? `<table>
    <tr><th>Recipient</th><th>Registry no.</th><th>Tax exemption</th><th>Tax office</th></tr>
    <tr>
      <td>${e(data.ngo.name)}</td>
      <td>${e(data.ngo.authorization.registryNumber ?? "—")}</td>
      <td>${e(data.ngo.authorization.taxAuthorizationRef ?? "—")}${
          data.ngo.authorization.taxAuthorizationDate
            ? " · " + e(data.ngo.authorization.taxAuthorizationDate)
            : ""
        }</td>
      <td>${e(data.ngo.authorization.taxOffice ?? "—")}</td>
    </tr>
  </table>`
      : ""
  }
${
    options.forSigning
      ? `<div class="sig">
    <div><signature-field name="Company signature" role="Company" required="true" style="width: 200px; height: 70px; display: inline-block;"></signature-field><br>${e(data.company.name)}<br><date-field name="Company date" role="Company" required="true" style="width: 120px; height: 18px; display: inline-block;"></date-field></div>
    <div><signature-field name="NGO signature" role="NGO" required="true" style="width: 200px; height: 70px; display: inline-block;"></signature-field><br>${e(data.ngo.name)}<br><date-field name="NGO date" role="NGO" required="true" style="width: 120px; height: 18px; display: inline-block;"></date-field></div>
  </div>`
      : `  <div class="sig">
    <div>sur.plus · Florian Lechner</div>
    <div>${e(isCert ? data.ngo.name : data.company.name)}${
      isCert && data.ngo.authorization?.authorizedSigner
        ? `<br><span style="font-family:system-ui,sans-serif;font-size:11px;color:#666">${e(
            data.ngo.authorization.authorizedSigner
          )}${
            data.ngo.authorization.authorizedSignerRole
              ? ", " + e(data.ngo.authorization.authorizedSignerRole)
              : ""
          }</span>`
        : ""
    }</div>
  </div>
`
  }
  <hr>
  <p class="foot">
    Methodology: CO2e — ${e(data.methodology.co2)}; social value — ${e(data.methodology.socialValue)};
    reporting — ${e(data.methodology.reporting)}. Generated by sur.plus from the audited match record.
    Verify this document by quoting reference ${e(data.reference)} to service@surpluspurpose.com.
  </p>
</div>
${options.forSigning ? "" : `<p class="print-hint">Use your browser's print dialog to save this document as PDF.</p>`}
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

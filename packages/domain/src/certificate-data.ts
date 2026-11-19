import { unlocksContact } from "./model";
import type { Company, Document, Listing, Match, Need, Ngo } from "./model";

/**
 * M2/C3 — render data for generated evidence documents.
 *
 * Donation certificates and CSRD notes are deterministic projections of match
 * data: no stored file, the download route renders them on the fly. This
 * module builds the data; HTML rendering lives in the route layer.
 *
 * Trust boundary (invariant 1): rendering exposes the full NGO identity, so a
 * document only renders once the match state unlocks contact. Before that the
 * caller gets `document_not_ready`.
 */

export type CertificateRenderData = {
  kind: "donation_certificate" | "csrd_note";
  /** Deterministic reference, e.g. SP-CERT-2026-MAT-THINKPADS. */
  reference: string;
  documentTitle: string;
  issuedAt: string;
  company: { name: string; city: string; country: string };
  ngo: {
    name: string;
    city: string;
    country: string;
    focus: string;
    /** A1 · recipient authorisation for a legally complete donation receipt. */
    authorization?: {
      registryNumber: string | null;
      taxAuthorizationRef: string | null;
      taxAuthorizationDate: string | null;
      taxOffice: string | null;
      authorizedSigner: string | null;
      authorizedSignerRole: string | null;
    };
  };
  goods: {
    title: string;
    category: string;
    quantity: number;
    unit: string;
    condition: string;
  };
  impact: {
    co2Tons: number;
    estimatedValueEur: number;
    beneficiaries: number | null;
  };
  logistics: {
    pickupDate: string | null;
    deliveryDate: string | null;
    matchState: Match["state"];
  };
  methodology: {
    co2: string;
    socialValue: string;
    reporting: string;
  };
};

export type CertificateRenderResult =
  | { ok: true; data: CertificateRenderData }
  | { ok: false; reason: "unsupported_document_kind" | "match_data_missing" | "document_not_ready" };

export function buildCertificateRenderData(input: {
  document: Document;
  match: Match | undefined;
  listing: Listing | undefined;
  need: Need | undefined;
  ngo: Ngo | undefined;
  company: Company | undefined;
}): CertificateRenderResult {
  const { document, match, listing, need, ngo, company } = input;

  const kind =
    document.kind === "certificate"
      ? ("donation_certificate" as const)
      : document.kind === "report"
        ? ("csrd_note" as const)
        : null;
  if (!kind) return { ok: false, reason: "unsupported_document_kind" };

  if (!match || !listing || !ngo || !company) {
    return { ok: false, reason: "match_data_missing" };
  }
  if (!unlocksContact(match.state)) {
    return { ok: false, reason: "document_not_ready" };
  }

  const year = new Date(document.createdAt).getUTCFullYear();
  const prefix = kind === "donation_certificate" ? "SP-CERT" : "SP-CSRD";

  return {
    ok: true,
    data: {
      kind,
      reference: `${prefix}-${year}-${match.id.toUpperCase().slice(0, 18)}`,
      documentTitle:
        kind === "donation_certificate"
          ? "Donation certificate"
          : "CSRD evidence note",
      issuedAt: document.publishedAt ?? document.createdAt,
      company: {
        name: company.name,
        city: company.city,
        country: company.country
      },
      ngo: {
        name: ngo.name,
        city: ngo.city,
        country: ngo.country,
        focus: ngo.focus,
        authorization: {
          registryNumber: ngo.registryNumber ?? null,
          taxAuthorizationRef: ngo.taxAuthorizationRef ?? null,
          taxAuthorizationDate: ngo.taxAuthorizationDate ?? null,
          taxOffice: ngo.taxOffice ?? null,
          authorizedSigner: ngo.authorizedSigner ?? null,
          authorizedSignerRole: ngo.authorizedSignerRole ?? null
        }
      },
      goods: {
        title: listing.title,
        category: listing.category,
        quantity: listing.quantity,
        unit: listing.unit,
        condition: listing.condition
      },
      impact: {
        co2Tons: match.co2Tons,
        estimatedValueEur: Math.round(listing.quantity * listing.unitValue),
        beneficiaries: need?.beneficiaries ?? null
      },
      logistics: {
        pickupDate: match.pickupDate,
        deliveryDate: match.deliveryDate,
        matchState: match.state
      },
      methodology: {
        co2: "GHG Protocol",
        socialValue: "GIIN IRIS+",
        reporting: "ESRS/CSRD"
      }
    }
  };
}

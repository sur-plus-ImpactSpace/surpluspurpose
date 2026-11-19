import type { Document, Listing, Match, MatchState } from "./model";

/**
 * A4 — Nachweis & Impact (read-only domain projection).
 *
 * Turns a workspace's visible matches into impact summaries the dashboards can
 * render directly: real CO2e / quantity / value figures per match plus the
 * evidence state of the donation certificate and the CSRD note.
 *
 * Pure and deterministic: takes data the caller is already allowed to see
 * (repository access rules stay upstream), returns summaries sorted newest first.
 */

export type EvidenceStatus = "ready" | "in_progress" | "pending";

export type EvidenceRef = {
  status: EvidenceStatus;
  documentId: string | null;
  title: string | null;
};

export type MatchImpactSummary = {
  matchId: string;
  state: MatchState;
  /** Listing title, the human-readable headline of the match. */
  headline: string;
  /** Listing category, used e.g. to pick a matching illustration. */
  category: string | null;
  /** Copilot match score (0-100) behind the curated matching promise. */
  score: number;
  co2Tons: number;
  quantity: number | null;
  unit: string | null;
  /** quantity × unitValue of the listing, rounded to whole euros. */
  estimatedValueEur: number | null;
  certificate: EvidenceRef;
  csrdNote: EvidenceRef;
  createdAt: string;
};

export type MatchImpactInput = {
  matches: Match[];
  listings: Listing[];
  documents: Document[];
};

const READY_DOCUMENT_STATUSES = new Set(["approved", "published"]);

export function buildMatchImpactSummaries(input: MatchImpactInput): MatchImpactSummary[] {
  const listingById = new Map(input.listings.map((listing) => [listing.id, listing]));

  return input.matches
    .filter((match) => !["cancelled", "expired", "failed"].includes(match.state))
    .map((match) => {
      const listing = listingById.get(match.listingId);

      return {
        matchId: match.id,
        state: match.state,
        headline: listing?.title ?? "Surplus match",
        category: listing?.category ?? null,
        score: match.score,
        co2Tons: match.co2Tons,
        quantity: listing?.quantity ?? null,
        unit: listing?.unit ?? null,
        estimatedValueEur: listing ? Math.round(listing.quantity * listing.unitValue) : null,
        certificate: evidenceRef(match.id, "certificate", input.documents),
        csrdNote: evidenceRef(match.id, "report", input.documents),
        createdAt: match.createdAt
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function evidenceRef(
  matchId: string,
  kind: Document["kind"],
  documents: Document[]
): EvidenceRef {
  const candidates = documents
    .filter((document) => document.matchId === matchId && document.kind === kind)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const ready = candidates.find((document) => READY_DOCUMENT_STATUSES.has(document.status));
  const document = ready ?? candidates[0];

  if (!document) {
    return { status: "pending", documentId: null, title: null };
  }

  return {
    status: ready ? "ready" : "in_progress",
    documentId: document.id,
    title: document.title
  };
}

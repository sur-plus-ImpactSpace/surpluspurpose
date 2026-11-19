import type { Co2Factor, Listing, Match, MatchState, Need, Ngo } from "./model";

/**
 * Aggregated, ESRS-aligned impact report for the in-app Impact Dashboard and
 * its exportable CSRD report. Mirrors the sample report on the landing page
 * (Key metrics · E5 resource use · E1 Scope-3 avoided emissions · S3 affected
 * communities) but is computed live from the workspace's own audited matches.
 *
 * Pure and deterministic. By default only `completed` (NGO-confirmed) matches
 * count, so every figure is audit-grade — the same standard the sample states.
 */

export type ImpactCategoryRow = {
  category: string;
  units: number;
  weightKg: number;
  valueEur: number;
  co2Tons: number;
};

export type ImpactBeneficiaryRow = {
  matchId: string;
  date: string;
  ngoName: string;
  country: string;
  category: string;
  valueEur: number;
  /** Per donation, so the exported report lists every one of them. */
  title: string;
  units: number;
  weightKg: number;
  co2Tons: number;
};

export type ImpactGeoRow = {
  country: string;
  ngos: number;
  matches: number;
  valueEur: number;
};

/** A reporting period, inclusive, as YYYY-MM-DD. Either end may be open. */
export type ReportPeriod = { from: string | null; to: string | null };

export type ImpactReport = {
  /** The period the figures cover; null for "all time". */
  period: ReportPeriod | null;
  totals: {
    valueEur: number;
    co2Tons: number;
    matches: number;
    ngos: number;
    countries: number;
    weightKg: number;
  };
  byCategory: ImpactCategoryRow[];
  beneficiaries: ImpactBeneficiaryRow[];
  geoReach: ImpactGeoRow[];
};

export type ImpactReportInput = {
  matches: Match[];
  listings: Listing[];
  needs: Need[];
  ngos: Ngo[];
  /** Match states that count as realised impact. Default: completed only. */
  countedStates?: MatchState[];
  /** Only donations dated inside this period count (see impactDate). */
  period?: ReportPeriod | null;
  /**
   * The maintained CO2 table (ADR 0028 D6). A category with a factor is computed
   * from it: weight x factor. A category without one falls back to the figure
   * stored on the match, so nothing drops to zero before Ops fills the table.
   */
  co2Factors?: Co2Factor[];
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a requested period from query parameters. Blank means open-ended;
 * a malformed date or an end before the start is refused rather than guessed.
 */
export function parseReportPeriod(
  from: string | null | undefined,
  to: string | null | undefined
): { ok: true; period: ReportPeriod | null } | { ok: false; reason: "invalid_period" } {
  const start = from?.trim() || null;
  const end = to?.trim() || null;
  for (const value of [start, end]) {
    if (value !== null && (!DATE_ONLY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      return { ok: false, reason: "invalid_period" };
    }
  }
  if (start && end && start > end) return { ok: false, reason: "invalid_period" };

  return { ok: true, period: start || end ? { from: start, to: end } : null };
}

/** The day a donation counts for: when it was delivered, else when the match began. */
export function impactDate(match: Pick<Match, "deliveryDate" | "createdAt">): string {
  return (match.deliveryDate ?? match.createdAt).slice(0, 10);
}

const DEFAULT_COUNTED_STATES: MatchState[] = ["completed"];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildImpactReport(input: ImpactReportInput): ImpactReport {
  const counted = new Set(input.countedStates ?? DEFAULT_COUNTED_STATES);
  const listingById = new Map(input.listings.map((listing) => [listing.id, listing]));
  const needById = new Map(input.needs.map((need) => [need.id, need]));
  const ngoById = new Map(input.ngos.map((ngo) => [ngo.id, ngo]));
  const factorByCategory = new Map((input.co2Factors ?? []).map((factor) => [factor.category, factor.kgCo2ePerKg]));

  const categories = new Map<string, ImpactCategoryRow>();
  const beneficiaries: ImpactBeneficiaryRow[] = [];
  const geo = new Map<string, { ngoIds: Set<string>; matches: number; valueEur: number }>();
  const ngoIds = new Set<string>();
  const countryIds = new Set<string>();

  let totalValue = 0;
  let totalCo2 = 0;
  let totalWeight = 0;
  let matchCount = 0;

  for (const match of input.matches) {
    if (!counted.has(match.state)) continue;
    const day = impactDate(match);
    if (input.period?.from && day < input.period.from) continue;
    if (input.period?.to && day > input.period.to) continue;
    const listing = listingById.get(match.listingId);
    const need = needById.get(match.needId);
    const ngo = need ? ngoById.get(need.ngoId) : undefined;
    if (!listing) continue;

    const valueEur = Math.round(listing.quantity * listing.unitValue);
    const weightKg = listing.weightKg * listing.quantity;
    const category = listing.category;
    const factor = factorByCategory.get(category);
    const co2 = factor === undefined ? match.co2Tons : (weightKg * factor) / 1000;

    matchCount += 1;
    totalValue += valueEur;
    totalCo2 += co2;
    totalWeight += weightKg;

    const row = categories.get(category) ?? {
      category,
      units: 0,
      weightKg: 0,
      valueEur: 0,
      co2Tons: 0
    };
    row.units += listing.quantity;
    row.weightKg += weightKg;
    row.valueEur += valueEur;
    row.co2Tons += co2;
    categories.set(category, row);

    if (ngo) {
      ngoIds.add(ngo.id);
      countryIds.add(ngo.country);
      beneficiaries.push({
        matchId: match.id,
        date: day,
        ngoName: ngo.name,
        country: ngo.country,
        category,
        valueEur,
        title: listing.title,
        units: listing.quantity,
        weightKg: Math.round(weightKg),
        co2Tons: round2(co2)
      });
      const geoRow = geo.get(ngo.country) ?? { ngoIds: new Set<string>(), matches: 0, valueEur: 0 };
      geoRow.ngoIds.add(ngo.id);
      geoRow.matches += 1;
      geoRow.valueEur += valueEur;
      geo.set(ngo.country, geoRow);
    }
  }

  const byCategory = [...categories.values()]
    .map((row) => ({ ...row, co2Tons: round2(row.co2Tons) }))
    .sort((a, b) => b.valueEur - a.valueEur);

  const geoReach = [...geo.entries()]
    .map(([country, row]) => ({
      country,
      ngos: row.ngoIds.size,
      matches: row.matches,
      valueEur: row.valueEur
    }))
    .sort((a, b) => b.valueEur - a.valueEur);

  beneficiaries.sort((a, b) => b.date.localeCompare(a.date));

  return {
    period: input.period ?? null,
    totals: {
      valueEur: totalValue,
      co2Tons: round2(totalCo2),
      matches: matchCount,
      ngos: ngoIds.size,
      countries: countryIds.size,
      weightKg: Math.round(totalWeight)
    },
    byCategory,
    beneficiaries,
    geoReach
  };
}

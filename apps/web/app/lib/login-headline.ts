import "server-only";
import { unstable_cache } from "next/cache";
import { buildImpactReport, loadRepositoryDataFromSupabaseRest } from "@surplus/domain";

/**
 * The one honest number the public /login hero can show: the realised, audited
 * value sur.plus has already moved from corporate surplus to verified NGOs.
 *
 * Computed with the SAME rule as the in-app Impact dashboard (buildImpactReport,
 * completed/NGO-confirmed matches only) so the two never drift. Null whenever
 * there is nothing real to claim yet — pre-launch, no Supabase, or any load
 * error — and the hero falls back to a plain brand statement. We never invent a
 * figure. Server-only (service key), cached platform-wide for 5 minutes so this
 * never becomes a per-request full load.
 *
 * TODO (DB phase): replace the full repository load with a dedicated
 * security-definer aggregate RPC (`platform_impact_totals`) — cheaper and it
 * drops the service-key dependency for a purely public, non-PII number.
 */
export type LoginHeadline = {
  valueEur: number;
  matches: number;
  ngos: number;
  weightKg: number;
  co2Tons: number;
};

async function computeLoginHeadline(): Promise<LoginHeadline | null> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const data = await loadRepositoryDataFromSupabaseRest({ url, key });
    const { totals } = buildImpactReport({
      matches: data.matches,
      listings: data.listings,
      needs: data.needs,
      ngos: data.ngos
    });
    if (totals.valueEur <= 0) return null;

    return {
      valueEur: totals.valueEur,
      matches: totals.matches,
      ngos: totals.ngos,
      weightKg: totals.weightKg,
      co2Tons: totals.co2Tons
    };
  } catch {
    // The hero is a nice-to-have; a data hiccup must never break sign-in.
    return null;
  }
}

const cachedLoginHeadline = unstable_cache(computeLoginHeadline, ["login-headline"], {
  revalidate: 300
});

export function loadLoginHeadline(): Promise<LoginHeadline | null> {
  return cachedLoginHeadline();
}

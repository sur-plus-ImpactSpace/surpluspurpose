import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActorContext, PlanTier, RepositoryData, SurplusRepository } from "@surplus/domain";
import { initialsFrom, type WorkspaceIdentity } from "../components/shell/WorkspaceShell";
import { LOCALE_COOKIE, getDictionary, resolveLocaleFrom, type Dictionary, type Locale } from "./i18n";
import { supabaseBrowserConfigFromEnv, type SupabaseBrowserConfig } from "./service-chat-realtime";
import { adminMfaMissing, loadServerSupabaseSession } from "./server-supabase";
import { WorkspaceProfileMissingError, loadWorkspaceData } from "./workspace-data";

export type SearchParams = Record<string, string | string[] | undefined>;

export type ResolvedWorkspace = {
  actor: ActorContext;
  authConfig: SupabaseBrowserConfig;
  data: RepositoryData;
  identity: WorkspaceIdentity;
  locale: Locale;
  repo: SurplusRepository;
  source: "preview" | "supabase";
  t: Dictionary;
  warning: string | null;
};

/**
 * Shared auth+workspace resolution for the route-based authenticated pages
 * (e.g. /documents). Mirrors the guard in `app/page.tsx` but, unlike the
 * overview, a sub-route cannot render the "provisioning pending" surface —
 * so a missing profile redirects home (`/`), where that state lives. No loop:
 * `/` renders pending inline instead of redirecting.
 */
export async function resolveWorkspaceForRoute(
  searchParamsPromise?: Promise<SearchParams>
): Promise<ResolvedWorkspace> {
  const params = searchParamsPromise ? await searchParamsPromise : {};
  const cookieStore = await cookies();
  const locale = resolveLocaleFrom(params.lang, cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);

  const authConfig = supabaseBrowserConfigFromEnv();
  if (!authConfig) redirect("/demo");

  const session = await loadServerSupabaseSession(authConfig);
  if (!session) redirect("/login");
  if (session.mfaRequired) redirect("/login");

  const workspace = await loadWorkspaceData({
    authorization: `Bearer ${session.accessToken}`,
    preferredUserId: session.userId
  }).catch((error: unknown) => {
    if (error instanceof WorkspaceProfileMissingError) return null;
    throw error;
  });

  if (!workspace) redirect("/");

  const { actor, data, repository: repo, source, warning } = workspace;
  // The overview renders the mandatory 2FA enrollment for admins (REQ-NFR-03).
  if (adminMfaMissing(actor.role, session)) redirect("/");

  return {
    actor,
    authConfig,
    data,
    identity: workspaceIdentity(actor, data, repo, t),
    locale,
    repo,
    source,
    t,
    warning
  };
}

/**
 * Sidebar identity for the authenticated workspace. The name is real data and
 * therefore never translated; the tier is chrome and comes from the dictionary.
 * Shared by the overview (`app/page.tsx`) and the route-based pages.
 */
const PLAN_LABEL: Record<PlanTier, string> = {
  registered: "Registered",
  seed: "Seed",
  tree: "Tree"
};

export function workspaceIdentity(
  actor: ActorContext,
  data: RepositoryData,
  repo: SurplusRepository,
  t: Dictionary
): WorkspaceIdentity {
  if (actor.role === "corporate") {
    const company = repo.companies.get(actor.companyId);
    const name = company?.name ?? "Corporate";
    // Third occurrence of the same fail-open shape this week: a binary
    // tree/seed check that labelled a `registered` (unpaid) company "Seed".
    // The E2E signup surfaced it — the sidebar called a browse-only account a
    // paying workspace. Unknown plans read as Registered, never as paid.
    const plan = company ? PLAN_LABEL[company.plan] : PLAN_LABEL.registered;

    return { name, tier: `${plan} ${t.workspaceTag}`, initials: initialsFrom(name) };
  }

  if (actor.role === "ngo") {
    const name = data.ngos.find((item) => item.id === actor.ngoId)?.name ?? "NGO";

    return { name, tier: t.tiers.ngo, initials: initialsFrom(name) };
  }

  return { name: "sur.plus Ops", tier: t.tiers.admin, initials: "SP" };
}

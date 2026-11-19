import { isCompanyVerified } from "@surplus/domain";
import type { Metadata } from "next";
import { PageCrumb } from "../components/PageCrumb";
import { ListingCreateForm } from "../components/ListingCreateForm";
import { ListingPanel } from "../components/dashboard/shared";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Listings"
};

/**
 * Corporate surplus management as its own route (R4): list what you have,
 * add more, and let sur.plus match it. Completes the route-based IA.
 * Unverified companies stay browse-only — listing create waits on verification
 * (REQ-AUTH-01 / ADR 0027).
 */
export default async function ListingsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { actor, authConfig, data, identity, locale, repo, t } = await resolveWorkspaceForRoute(searchParams);
  const listings = actor.role === "corporate" ? repo.listings.listForCompany(actor.companyId) : [];
  const verified =
    actor.role === "corporate"
      ? isCompanyVerified(data.companies.find((company) => company.id === actor.companyId))
      : true;

  return (
    <WorkspaceShell
      activeHref="/listings"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={t.routes.listings.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
        {!verified ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Your company is still under review. This workspace is{" "}
            <span className="font-medium text-foreground">browse only</span> — you cannot list
            surplus until Ops verifies you. Finish verification in{" "}
            <a className="font-semibold text-primary hover:underline" href="/account">
              Account
            </a>
            .
          </p>
        ) : null}
        <ListingPanel actorUserId={actor.userId} authConfig={authConfig} listings={listings} locale={locale} />
        {actor.role === "corporate" && verified ? (
          <ListingCreateForm actorUserId={actor.userId} authConfig={authConfig} locale={locale} />
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

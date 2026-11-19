import { isNgoVerified } from "@surplus/domain";
import type { Metadata } from "next";
import { PageCrumb } from "../components/PageCrumb";
import { NeedCreateForm } from "../components/NeedCreateForm";
import { NeedPanel } from "../components/dashboard/shared";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Needs"
};

/**
 * NGO need management as its own route (R4): post what your NGO can receive,
 * and let sur.plus match it with corporate surplus. Completes the route IA.
 * Unverified NGOs may still save drafts (REQ-AUTH-01); they stay off the market.
 */
export default async function NeedsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { actor, authConfig, data, identity, locale, repo, t } = await resolveWorkspaceForRoute(searchParams);
  const needs = actor.role === "ngo" ? repo.needs.listForNgo(actor.ngoId) : [];
  const verified =
    actor.role === "ngo" ? isNgoVerified(data.ngos.find((ngo) => ngo.id === actor.ngoId)) : true;

  return (
    <WorkspaceShell
      activeHref="/needs"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={t.routes.needs.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
        {!verified ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Your organisation is still under review. You can save needs as{" "}
            <span className="font-medium text-foreground">drafts</span> — they stay private and
            cannot be matched until Ops verifies you. Drafts go live automatically after approval.
          </p>
        ) : null}
        <NeedPanel needs={needs} locale={locale} matches={repo.matches.list(actor)} />
        {actor.role === "ngo" ? (
          <NeedCreateForm actorUserId={actor.userId} authConfig={authConfig} locale={locale} />
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

import { isCompanyVerified, isNgoVerified, needOpenQuantity, needQuantityLabel } from "@surplus/domain";
import { ProposeMatchPanel } from "../components/ProposeMatchPanel";
import type { Metadata } from "next";
import { PageCrumb } from "../components/PageCrumb";
import { LogisticsPanel, ServicePanel } from "../components/dashboard/shared";
import { MatchFailureControls } from "../components/MatchFailureControls";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import { serviceChatRealtimeConfigFromEnv } from "../lib/service-chat-realtime";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Matches"
};

/**
 * Matches as their own route (R4): every match, its delivery status, and the
 * conversation that keeps it auditable — in one place instead of scattered
 * across the overview scroll. Houses the party-to-party chat (C1/C2).
 */
export default async function MatchesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { actor, authConfig, data, identity, locale, repo, source, t } = await resolveWorkspaceForRoute(searchParams);
  const matches = repo.matches.list(actor);
  const logisticsItems = matches.map((match) => ({
    match,
    title: repo.listings.get(match.listingId)?.title ?? match.id
  }));
  const primaryMatch = matches[0];
  const realtimeConfig = serviceChatRealtimeConfigFromEnv(source);
  const messages = primaryMatch ? repo.messages.listForMatch(primaryMatch.id, actor) : [];

  return (
    <WorkspaceShell
      activeHref="/matches"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={t.routes.matches.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
        {actor.role === "admin" || actor.role === "editor" ? (
          <ProposeMatchPanel
            actorUserId={actor.userId}
            authConfig={authConfig}
            listings={data.listings
              .filter(
                (listing) =>
                  listing.state === "open" &&
                  isCompanyVerified(data.companies.find((company) => company.id === listing.companyId))
              )
              .map((listing) => ({
                id: listing.id,
                quantity: listing.quantity,
                label: `${listing.title} · ${data.companies.find((company) => company.id === listing.companyId)?.name ?? listing.companyId}`
              }))}
            needs={data.needs
              .filter((need) => need.state === "open" && isNgoVerified(data.ngos.find((ngo) => ngo.id === need.ngoId)))
              .map((need) => {
                const open = needOpenQuantity(need, data.matches);

                return {
                  id: need.id,
                  open,
                  label: `${need.title} · ${data.ngos.find((ngo) => ngo.id === need.ngoId)?.name ?? need.ngoId} · ${needQuantityLabel(need, open)}`
                };
              })
              // A need whose parts already add up takes no further proposal.
              .filter((option) => option.open === null || option.open > 0)}
          />
        ) : null}
        <LogisticsPanel items={logisticsItems} />
        {(actor.role === "admin" || actor.role === "editor") &&
        matches.some((match) => match.state === "in_transit" || match.state === "delivered") ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <h2 className="text-lg font-semibold">Shipped matches that failed</h2>
            {matches
              .filter((match) => match.state === "in_transit" || match.state === "delivered")
              .map((match) => (
                <div className="mt-3 border-t border-border pt-3 text-sm" key={match.id}>
                  <p className="font-semibold">
                    {repo.listings.get(match.listingId)?.title ?? match.id}{" "}
                    <span className="text-muted-foreground">· {match.state.replace(/_/g, " ")}</span>
                  </p>
                  <MatchFailureControls actorUserId={actor.userId} authConfig={authConfig} matchId={match.id} />
                </div>
              ))}
          </section>
        ) : null}
        {actor.role === "corporate" || actor.role === "ngo" ? (
          <ServicePanel
            actor={actor}
            authConfig={authConfig}
            match={primaryMatch}
            messages={messages}
            realtimeConfig={realtimeConfig}
            role={actor.role === "corporate" ? "Corporate" : "NGO"}
          />
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

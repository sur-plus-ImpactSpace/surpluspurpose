import type { Metadata } from "next";
import { PageCrumb } from "../components/PageCrumb";
import { EvidencePanel } from "../components/dashboard/shared";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Documents"
};

/**
 * The compliance moat as its own route (R5): donation certificates and the
 * CSRD note — the reason €575/month gets paid — get a dedicated page instead
 * of a panel buried in the overview scroll. First real route of the workspace
 * IA migration (R4).
 */
export default async function DocumentsPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { actor, authConfig, identity, locale, repo, t } = await resolveWorkspaceForRoute(searchParams);
  const documents = repo.documents.list(actor);
  const downloadActor = authConfig ? undefined : actor.userId;

  return (
    <WorkspaceShell
      activeHref="/documents"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={t.routes.documents.title} />

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <EvidencePanel
          actorUserId={actor.userId}
          authConfig={authConfig}
          documents={documents}
          downloadActor={downloadActor}
          envelopes={repo.signatureEnvelopes.list(actor)}
          viewerRole={actor.role}
        />
      </div>
    </WorkspaceShell>
  );
}

import { redirect } from "next/navigation";
import { isOpsAdminRole, isOpsRole, type ActorContext, type RepositoryData, type SurplusRepository } from "@surplus/domain";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import { resolveWorkspaceForRoute, type SearchParams } from "../../lib/workspace-view";
import { PageCrumb } from "../PageCrumb";
import { WORKSPACE_NAV, WorkspaceShell } from "../shell/WorkspaceShell";

type AdminContext = {
  actor: Extract<ActorContext, { role: "admin" | "editor" }>;
  authConfig: SupabaseBrowserConfig;
  data: RepositoryData;
  repo: SurplusRepository;
};

/**
 * One Ops tab: shared shell + title. Admins and editors may enter; pages that
 * need platform-admin rights check `isOpsAdminRole` themselves (REQ-OPS-14).
 */
export async function AdminPage({
  activeHref,
  children,
  requireAdmin = false,
  searchParams,
  title
}: {
  activeHref: string;
  children: (context: AdminContext) => React.ReactNode;
  /** When true, only `admin` may open the page (editors bounce to /ops). */
  requireAdmin?: boolean;
  searchParams?: Promise<SearchParams>;
  title: string;
}) {
  const { actor, authConfig, data, identity, locale, repo, t } = await resolveWorkspaceForRoute(searchParams);
  if (!isOpsRole(actor.role)) redirect("/ops");
  if (requireAdmin && !isOpsAdminRole(actor.role)) redirect("/ops");

  const nav = isOpsAdminRole(actor.role)
    ? WORKSPACE_NAV.admin
    : WORKSPACE_NAV.admin.filter((item) => item.href !== "/ops/admins");

  return (
    <WorkspaceShell
      activeHref={activeHref}
      activeRole="admin"
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={nav}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={title} />
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
        {children({
          actor: actor as Extract<ActorContext, { role: "admin" | "editor" }>,
          authConfig,
          data,
          repo
        })}
      </div>
    </WorkspaceShell>
  );
}

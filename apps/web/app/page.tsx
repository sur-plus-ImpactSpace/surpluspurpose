import {
  isOpsRole,
  type ActorContext,
  type RepositoryData,
  type SurplusRepository
} from "@surplus/domain";
import { redirect } from "next/navigation";
import { AuthSessionControls } from "./components/AuthSessionControls";
import { SignedInLine } from "./components/SignedInLine";
import { PageCrumb } from "./components/PageCrumb";
import { TwoFactorSetup } from "./components/TwoFactorSetup";
import { ClaimWorkspacePanel } from "./components/ClaimWorkspacePanel";
import { InvitationAcceptancePanel } from "./components/InvitationAcceptancePanel";
import { AdminCockpit } from "./components/dashboard/AdminCockpit";
import { CorporateCockpit } from "./components/dashboard/CorporateCockpit";
import { NgoCockpit } from "./components/dashboard/NgoCockpit";
import { roleLabel } from "./components/dashboard/shared";
import { LoginHero, LoginShell } from "./components/shell/LoginShell";
import { WORKSPACE_NAV, WorkspaceShell } from "./components/shell/WorkspaceShell";
import { workspaceIdentity } from "./lib/workspace-view";
import { cookies, headers } from "next/headers";
import { adminHostFromEnv, hostName } from "./lib/admin-host";
import { LOCALE_COOKIE, getDictionary, resolveLocaleFrom, type Dictionary, type Locale } from "./lib/i18n";
import {
  supabaseBrowserConfigFromEnv,
  type SupabaseBrowserConfig
} from "./lib/service-chat-realtime";
import { loadLoginHeadline } from "./lib/login-headline";
import { adminMfaMissing, loadServerSupabaseSession } from "./lib/server-supabase";
import {
  WorkspaceProfileMissingError,
  loadWorkspaceData,
  type WorkspaceRole
} from "./lib/workspace-data";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({
  requiredRole,
  searchParams
}: {
  requiredRole?: WorkspaceRole;
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const preferredRole = roleFromSearchParams(params);
  const inviteToken = inviteTokenFromSearchParams(params);
  const cookieStore = await cookies();
  const locale = resolveLocaleFrom(params.lang, cookieStore.get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);
  const authConfig = supabaseBrowserConfigFromEnv();

  // Demo and real workspace are separate surfaces: without an auth backend
  // this deployment IS the demo; with one, anonymous visitors sign in first.
  if (!authConfig) redirect("/demo");

  const session = await loadServerSupabaseSession(authConfig);
  if (!session) {
    if (requiredRole === "admin") redirect("/ops/login");
    redirect(inviteToken ? `/login?invite_token=${encodeURIComponent(inviteToken)}` : "/login");
  }
  if (session.mfaRequired) redirect(requiredRole === "admin" ? "/ops/login" : "/login");

  const workspace = await loadWorkspaceData({
    authorization: session ? `Bearer ${session.accessToken}` : undefined,
    preferredUserId: session?.userId,
    preferredRole
  }).catch((error: unknown) => {
    if (session && error instanceof WorkspaceProfileMissingError) return null;
    throw error;
  });

  if (!workspace) {
    return (
      <WorkspaceProvisioningPending
        authConfig={authConfig}
        email={session?.email ?? null}
        inviteToken={inviteToken}
        locale={locale}
        t={t}
      />
    );
  }

  const { actor, data, openNeeds, repository: repo, source, warning } = workspace;
  // Admins work on their own host; the public host has no /ops pages.
  const adminHost = adminHostFromEnv();
  if (isOpsRole(actor.role) && adminHost && hostName((await headers()).get("host")) !== adminHost) {
    redirect(`https://${adminHost}/ops/login`);
  }
  if (adminMfaMissing(actor.role, session)) {
    return <AdminMfaRequired authConfig={authConfig} locale={locale} t={t} />;
  }
  // Ops home passes requiredRole "admin" to mean any Ops account (admin|editor).
  const roleOk =
    !requiredRole ||
    actor.role === requiredRole ||
    (requiredRole === "admin" && isOpsRole(actor.role));
  if (!roleOk) {
    return (
      <WorkspaceRoleRequired
        activeRole={actor.role}
        authConfig={authConfig}
        locale={locale}
        requiredRole={requiredRole}
        source={source}
        t={t}
      />
    );
  }

  const context = dashboardContext(actor, data, repo);
  const identity = workspaceIdentity(actor, data, repo, t);

  return (
    <WorkspaceShell
      activeHref="/"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={context.title} />
      {warning ? (
        <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            {t.workspacePreviewWarning} {warning}
          </p>
        </div>
      ) : null}

      {actor.role === "corporate" ? (
        <CorporateCockpit
          actor={actor}
          authConfig={authConfig}
          locale={locale}
          openNeeds={openNeeds}
          repo={repo}
        />
      ) : actor.role === "ngo" ? (
        <NgoCockpit actor={actor} authConfig={authConfig} data={data} locale={locale} repo={repo} />
      ) : isOpsRole(actor.role) ? (
        <AdminCockpit actor={actor} authConfig={authConfig} data={data} repo={repo} />
      ) : null}
    </WorkspaceShell>
  );
}

async function WorkspaceRoleRequired({
  activeRole,
  authConfig,
  locale,
  requiredRole,
  source,
  t
}: {
  activeRole: WorkspaceRole;
  authConfig: SupabaseBrowserConfig | null;
  locale: Locale;
  requiredRole: WorkspaceRole;
  source: "preview" | "supabase";
  t: Dictionary;
}) {
  const headline = await loadLoginHeadline();

  return (
    <LoginShell locale={locale} t={t} hero={<LoginHero headline={headline} locale={locale} t={t} />}>
      <p className="text-[11px] font-medium text-muted-foreground">
        {t.auth.roleRequired.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{t.auth.roleRequired.title}</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
        {t.auth.roleRequired.body(roleLabel(requiredRole), roleLabel(activeRole))}
      </p>

      <div className="mt-6 grid gap-3">
        <AuthSessionControls config={authConfig} source={source} t={t.auth.session} />
        <RoleSwitcher activeRole={activeRole} t={t} />
      </div>

      <a
        className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/10 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border"
        href="/ops/bootstrap"
      >
        {t.auth.roleRequired.bootstrap}
      </a>
    </LoginShell>
  );
}

/**
 * REQ-NFR-03: an admin signed in without a second factor lands here instead of
 * the Ops workspace. Enrolling and verifying a TOTP factor lifts the session to
 * aal2, and the refresh then opens the workspace. (An admin who already has a
 * factor but is still at aal1 is sent to /login for the challenge earlier.) 
 */
async function AdminMfaRequired({
  authConfig,
  locale,
  t
}: {
  authConfig: SupabaseBrowserConfig;
  locale: Locale;
  t: Dictionary;
}) {
  const headline = await loadLoginHeadline();

  return (
    <LoginShell locale={locale} t={t} hero={<LoginHero headline={headline} locale={locale} t={t} />}>
      <p className="text-[11px] font-medium text-primary">
        {t.auth.adminMfa.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{t.auth.adminMfa.title}</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{t.auth.adminMfa.lead}</p>
      <div className="mt-6 grid gap-4">
        <TwoFactorSetup config={authConfig} locale={locale} refreshOnEnable />
        <AuthSessionControls config={authConfig} source="supabase" t={t.auth.session} />
      </div>
    </LoginShell>
  );
}

async function WorkspaceProvisioningPending({
  authConfig,
  email,
  inviteToken,
  locale,
  t
}: {
  authConfig: SupabaseBrowserConfig | null;
  email: string | null;
  inviteToken: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  const headline = await loadLoginHeadline();

  return (
    <LoginShell locale={locale} t={t} hero={<LoginHero headline={headline} locale={locale} t={t} />}>
      <h1 className="text-3xl leading-tight sm:text-4xl">{t.auth.provisioning.title}</h1>

      <div className="mt-6 grid gap-5">
        <ClaimWorkspacePanel config={authConfig} t={t.auth.claim} />
        {/* Only for people arriving from an invitation email; self-signups use the form above. */}
        {inviteToken ? <InvitationAcceptancePanel config={authConfig} t={t.auth.invitation} token={inviteToken} /> : null}
        {authConfig ? <SignedInLine config={authConfig} email={email} /> : null}
      </div>
    </LoginShell>
  );
}

function RoleSwitcher({ activeRole, t }: { activeRole: WorkspaceRole; t: Dictionary }) {
  const labels = t.auth.roleRequired.roles;
  const roles: Array<{ role: WorkspaceRole; label: string; detail: string }> = [
    { role: "corporate", ...labels.corporate },
    { role: "ngo", ...labels.ngo },
    { role: "admin", ...labels.admin }
  ];

  return (
    <nav
      className="rounded-lg border border-border bg-muted p-2"
      aria-label={t.auth.roleRequired.switcherAria}
    >
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {roles.map((item) => (
          <a
            className={`rounded border px-3 py-2 text-sm ${
              item.role === activeRole
                ? "border-primary bg-card text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:bg-card"
            }`}
            href={item.role === "admin" ? "/ops" : `/?role=${item.role}`}
            key={item.role}
          >
            <span className="block font-semibold">{item.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

function dashboardContext(actor: ActorContext, data: RepositoryData, repo: SurplusRepository) {
  if (actor.role === "corporate") {
    const company = repo.companies.get(actor.companyId);

    return {
      kicker: "Corporate workspace",
      title: `${company?.name ?? "Company"} command center`,
      subtitle:
        "One workspace for surplus listings, NGO matches, service conversations, approval loops and evidence assets.",
      tone: "text-primary"
    };
  }
  if (actor.role === "ngo") {
    const ngo = data.ngos.find((item) => item.id === actor.ngoId);

    return {
      kicker: "NGO workspace",
      title: `${ngo?.name ?? "NGO"} incoming goods center`,
      subtitle:
        "A verification-first workspace for needs, incoming matches, service conversations and receipt evidence.",
      tone: "text-muted-foreground"
    };
  }

  return {
    kicker: "sur.plus Ops",
    title: "Internal operations cockpit",
    subtitle:
      "Invite-only admin workspace for verification, matching oversight, service threads, risk queues and audit controls.",
    tone: "text-muted-foreground"
  };
}

function roleFromSearchParams(params: SearchParams): WorkspaceRole {
  const role = params.role;
  const value = Array.isArray(role) ? role[0] : role;

  return value === "ngo" || value === "admin" || value === "editor" || value === "corporate" ? value : "corporate";
}

function inviteTokenFromSearchParams(params: SearchParams): string | null {
  const invite = params.invite;
  const value = Array.isArray(invite) ? invite[0] : invite;
  const trimmed = typeof value === "string" ? value.trim() : "";

  return trimmed.length >= 32 ? trimmed : null;
}

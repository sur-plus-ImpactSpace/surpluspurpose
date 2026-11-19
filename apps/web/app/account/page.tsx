import { isCompanyVerified, isOpsRole, PLAN_ENTITLEMENTS, type PlanTier } from "@surplus/domain";
import type { Metadata } from "next";
import { PageCrumb } from "../components/PageCrumb";
import { cookies } from "next/headers";
import { AppearancePanel } from "../components/AppearancePanel";
import { THEME_ACCENT_COOKIE, THEME_BASE_COOKIE, THEME_COOKIE, resolveTheme } from "../lib/theme";
import { AdminAccountPanel } from "../components/AdminAccountPanel";
import { Co2FactorsPanel } from "../components/Co2FactorsPanel";
import { CompanyVerificationUpload } from "../components/CompanyVerificationUpload";
import { PlanCheckoutPanel } from "../components/PlanCheckoutPanel";
import { InvitationCreatePanel } from "../components/InvitationCreatePanel";
import { TwoFactorSetup } from "../components/TwoFactorSetup";
import { InvitationQueuePanel, roleLabel } from "../components/dashboard/shared";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Account"
};

/**
 * Consolidated self-service account area (R-account): profile, security (2FA),
 * team & invitations, and plan — previously scattered across dashboard sections.
 * One place per gojiberr-style IA. Role-adaptive; bilingual via the route
 * dictionary.
 */
export default async function AccountPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { actor, authConfig, data, identity, locale, repo, t } = await resolveWorkspaceForRoute(searchParams);
  const cookieStore = await cookies();
  const theme = resolveTheme(
    cookieStore.get(THEME_COOKIE)?.value,
    cookieStore.get(THEME_BASE_COOKIE)?.value,
    cookieStore.get(THEME_ACCENT_COOKIE)?.value
  );
  const invitations = repo.invitations.list(actor);
  const members = repo.users.list(actor);

  const company = actor.role === "corporate" ? repo.companies.get(actor.companyId) : undefined;
  const ngo = actor.role === "ngo" ? data.ngos.find((item) => item.id === actor.ngoId) : undefined;
  const plan: PlanTier = company?.plan ?? "seed";
  const seatLimit = actor.role === "corporate" ? PLAN_ENTITLEMENTS[plan].userSeats : undefined;
  const canManageTeam = actor.role === "corporate" || actor.role === "ngo";

  return (
    <WorkspaceShell
      activeHref="/account"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={t.routes.account.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
        {actor.role === "corporate" && company ? (
          <PlanCheckoutPanel actorUserId={actor.userId} authConfig={authConfig} companyId={company.id} currentPlan={plan} />
        ) : null}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold sm:text-xl">{t.account.profileTitle}</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Field label={t.account.organisation} value={identity.name} />
            <Field label={t.account.role} value={roleLabel(actor.role)} />
            {company ? (
              <Field
                label={t.account.verification}
                value={(company.verificationState ?? "onboarding").replace(/_/g, " ")}
              />
            ) : null}
            {ngo ? <Field label={t.account.verification} value={ngo.verificationState.replace(/_/g, " ")} /> : null}
          </div>
          {actor.role === "corporate" && company && !isCompanyVerified(company) ? (
            <CompanyVerificationUpload actorUserId={actor.userId} config={authConfig} />
          ) : null}
        </section>

        <AppearancePanel accent={theme.accent ?? "#113b2e"} base={theme.base} choice={theme.choice} />

        <TwoFactorSetup config={authConfig} locale={locale} />

        {canManageTeam ? (
          <section className="grid gap-5 lg:grid-cols-2">
            {actor.role === "corporate" ? (
              <InvitationCreatePanel
                actorUserId={actor.userId}
                authConfig={authConfig}
                defaultOrgId={actor.companyId}
                defaultRole="corporate"
                mode="corporate"
                orgOptions={[{ id: actor.companyId, label: identity.name, role: "corporate" }]}
              />
            ) : actor.role === "ngo" ? (
              <InvitationCreatePanel
                actorUserId={actor.userId}
                authConfig={authConfig}
                defaultOrgId={actor.ngoId}
                defaultRole="ngo"
                mode="ngo"
                orgOptions={[{ id: actor.ngoId, label: identity.name, role: "ngo" }]}
              />
            ) : null}
            <InvitationQueuePanel
              actorUserId={actor.userId}
              authConfig={authConfig}
              data={data}
              invitations={invitations}
              members={members}
              canRemoveMembers={actor.role === "corporate"}
              seatLimit={seatLimit}
            />
          </section>
        ) : null}

        {actor.role === "admin" && authConfig ? (
          <AdminAccountPanel config={authConfig} />
        ) : null}

        {actor.role === "admin" ? (
          <Co2FactorsPanel
            actorUserId={actor.userId}
            authConfig={authConfig}
            rows={[
              ...new Set([...data.listings.map((listing) => listing.category), ...data.co2Factors.map((factor) => factor.category)])
            ]
              .sort((a, b) => a.localeCompare(b))
              .map((category) => ({
                category,
                kgCo2ePerKg: data.co2Factors.find((factor) => factor.category === category)?.kgCo2ePerKg ?? null
              }))}
          />
        ) : null}

        {isOpsRole(actor.role) ? null : (
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
          <h2 className="text-lg font-semibold sm:text-xl">{t.account.planTitle}</h2>
          {actor.role === "corporate" ? (
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              <span className="font-semibold">{t.account.planCurrent}:</span> {plan === "tree" ? "Tree" : "Seed"}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{t.account.planNgoFree}</p>
          )}
        </section>
        )}
      </div>
    </WorkspaceShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-3">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

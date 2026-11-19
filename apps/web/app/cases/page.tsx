import {
  DONATION_CASE_STEP_BY_NUMBER,
  isCompanyVerified,
  isOpsRole,
  type DonationCaseStep
} from "@surplus/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { PageCrumb } from "../components/PageCrumb";
import { DonationCaseCreateForm } from "../components/DonationCaseCreateForm";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Donation cases"
};

/**
 * Donation CASE list (REQ-CORP-01 / ADR 0033). Corporate sees its own cases;
 * Ops sees every case (RLS allows it) so it can allocate (REQ-MATCH-09).
 */
export default async function CasesPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { actor, authConfig, data, identity, locale, repo, t } = await resolveWorkspaceForRoute(searchParams);
  const isOps = isOpsRole(actor.role);
  const cases =
    actor.role === "corporate"
      ? repo.donationCases.listForCompany(actor.companyId)
      : isOps
        ? [...data.donationCases].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [];
  const companyName = (companyId: string) =>
    data.companies.find((company) => company.id === companyId)?.name ?? companyId;
  const verified =
    actor.role === "corporate"
      ? isCompanyVerified(data.companies.find((company) => company.id === actor.companyId))
      : true;

  return (
    <WorkspaceShell
      activeHref="/cases"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={t.routes.cases.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
        <header className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t.routes.cases.title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t.routes.cases.subtitle}</p>
        </header>

        {!verified ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Your company is still under review. This workspace is{" "}
            <span className="font-medium text-foreground">browse only</span> — you cannot open a
            donation case until Ops verifies you.
          </p>
        ) : null}

        <section className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Case</th>
                {isOps ? <th className="px-3 py-2 font-medium">Company</th> : null}
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Positions</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-muted-foreground" colSpan={isOps ? 6 : 5}>
                    No donation cases yet.
                  </td>
                </tr>
              ) : (
                cases.map((donationCase) => {
                  const positionCount = repo.donationPositions.listForCase(donationCase.id).length;
                  const stepKey = DONATION_CASE_STEP_BY_NUMBER[donationCase.step as DonationCaseStep];
                  return (
                    <tr key={donationCase.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link
                          className="font-medium text-primary hover:underline"
                          href={`/cases/${donationCase.id}`}
                        >
                          {donationCase.title}
                        </Link>
                      </td>
                      {isOps ? (
                        <td className="px-3 py-2 text-muted-foreground">
                          {companyName(donationCase.companyId)}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-muted-foreground">
                        {donationCase.step}/7 · {stepKey}
                        {donationCase.confirmedAt ? " · confirmed" : ""}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {donationCase.city}, {donationCase.country}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{donationCase.contactName}</td>
                      <td className="px-3 py-2">{positionCount}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {actor.role === "corporate" && verified ? (
          <DonationCaseCreateForm
            actorUserId={actor.userId}
            authConfig={authConfig}
            locale={locale}
          />
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildImpactReport, parseReportPeriod } from "@surplus/domain";
import type { Metadata } from "next";
import { PageCrumb } from "../components/PageCrumb";
import { ImpactReportView } from "../components/dashboard/ImpactReportView";
import { PrintExportButton } from "../components/dashboard/PrintExportButton";
import { WORKSPACE_NAV, WorkspaceShell } from "../components/shell/WorkspaceShell";
import { resolveWorkspaceForRoute, type SearchParams } from "../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Impact"
};

/**
 * Live Impact / CSRD dashboard (R-impact): the workspace's own audited matches
 * aggregated into an ESRS-aligned view (E5 · E1 · S3), mirroring the sample
 * report on the landing page but computed — never estimated. Exportable to a
 * print/PDF CSRD report. Bilingual via the route dictionary.
 */
export default async function ImpactPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const { actor, authConfig, data, identity, locale, repo, t } = await resolveWorkspaceForRoute(searchParams);
  const params = (await searchParams) ?? {};
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const requested = parseReportPeriod(first(params.from), first(params.to));
  const matches = repo.matches.list(actor);
  const report = buildImpactReport({
    matches,
    listings: data.listings,
    needs: data.needs,
    ngos: data.ngos,
    period: requested.ok ? requested.period : null,
    co2Factors: data.co2Factors
  });
  const exportQuery = new URLSearchParams();
  if (requested.ok && requested.period?.from) exportQuery.set("from", requested.period.from);
  if (requested.ok && requested.period?.to) exportQuery.set("to", requested.period.to);

  return (
    <WorkspaceShell
      activeHref="/impact"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb
        actions={report.totals.matches > 0 ? <PrintExportButton label={t.impact.exportCta} /> : null}
        current={t.routes.impact.title}
      />

      {actor.role === "corporate" ? (
        <section className="border-b border-border bg-card print:hidden">
          <form className="mx-auto flex max-w-7xl flex-wrap items-end gap-3 px-5 py-4 sm:px-8" method="get">
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              From
              <Input  defaultValue={report.period?.from ?? ""} name="from" type="date" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              To
              <Input  defaultValue={report.period?.to ?? ""} name="to" type="date" />
            </label>
            <Button variant="outline" type="submit">
              Show period
            </Button>
            {report.totals.matches > 0 ? (
              <span className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                <a className="text-primary hover:underline" href={`/api/reports/csrd?${new URLSearchParams({ ...Object.fromEntries(exportQuery), format: "html" })}`}>
                  Download CSRD report
                </a>
                <a className="text-primary hover:underline" href={`/api/reports/csrd?${new URLSearchParams({ ...Object.fromEntries(exportQuery), format: "csv" })}`}>
                  Download CSV
                </a>
              </span>
            ) : null}
            {requested.ok ? null : <span className="text-sm text-muted-foreground">Please enter valid dates, the start before the end.</span>}
          </form>
        </section>
      ) : null}

      <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <ImpactReportView report={report} t={t} locale={locale} />
      </div>
    </WorkspaceShell>
  );
}

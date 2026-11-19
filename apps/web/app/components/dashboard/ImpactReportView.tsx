import type { ImpactReport } from "@surplus/domain";
import type { Dictionary, Locale } from "../../lib/i18n";
import { categoryLabel } from "../../lib/catalog";

/**
 * Readable, ESRS-aligned rendering of the live impact report (Key metrics ·
 * E5 resource use · E1 Scope-3 avoided emissions · S3 affected communities),
 * mirroring the sample report on the landing page but computed from the
 * workspace's own audited matches. Pure/server-rendered; bilingual via `t`.
 */
export function ImpactReportView({
  report,
  t,
  locale
}: {
  report: ImpactReport;
  t: Dictionary;
  locale: Locale;
}) {
  const nf = new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US");
  const money = (v: number) => `€${nf.format(v)}`;
  const tons = (v: number) => `${nf.format(v)} tCO₂e`;
  const kg = (v: number) => `${nf.format(v)} kg`;

  if (report.totals.matches === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-8 text-center shadow-xs">
        <h2 className="text-xl font-semibold">{t.impact.emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-muted-foreground">{t.impact.emptyBody}</p>
      </section>
    );
  }

  const maxCo2 = Math.max(...report.byCategory.map((row) => row.co2Tons), 0.0001);

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi accent value={money(report.totals.valueEur)} label={t.impact.kpiValue} />
        <Kpi accent value={tons(report.totals.co2Tons)} label={t.impact.kpiCo2} />
        <Kpi accent value={nf.format(report.totals.matches)} label={t.impact.kpiMatches} />
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        <Kpi value={nf.format(report.totals.ngos)} label={t.impact.kpiNgos} />
        <Kpi value={nf.format(report.totals.countries)} label={t.impact.kpiCountries} />
        <Kpi value={kg(report.totals.weightKg)} label={t.impact.kpiWeight} />
      </section>

      <ReportSection eyebrow="E5" title={t.impact.e5Title} lead={t.impact.e5Lead}>
        <Table head={[t.impact.colCategory, t.impact.colUnits, t.impact.colWeight, t.impact.colValue]} align={[false, true, true, true]}>
          {report.byCategory.map((row) => (
            <tr key={row.category} className="border-t border-border">
              <Td>{categoryLabel(row.category, locale)}</Td>
              <Td right>{nf.format(row.units)}</Td>
              <Td right>{kg(row.weightKg)}</Td>
              <Td right>{money(row.valueEur)}</Td>
            </tr>
          ))}
          <tr className="border-t-2 border-border font-semibold">
            <Td>{t.impact.total}</Td>
            <Td right>{nf.format(report.byCategory.reduce((s, r) => s + r.units, 0))}</Td>
            <Td right>{kg(report.totals.weightKg)}</Td>
            <Td right>{money(report.totals.valueEur)}</Td>
          </tr>
        </Table>
      </ReportSection>

      <ReportSection eyebrow="E1" title={t.impact.e1Title} lead={t.impact.e1Lead}>
        <div className="mb-5 grid gap-2">
          {report.byCategory.map((row) => (
            <div key={row.category} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-sm text-muted-foreground">{categoryLabel(row.category, locale)}</span>
              <span className="h-3 rounded-full bg-muted">
                <span
                  className="block h-3 rounded-full bg-primary"
                  style={{ width: `${Math.max(4, (row.co2Tons / maxCo2) * 100)}%` }}
                />
              </span>
              <span className="text-sm font-semibold tabular-nums">{tons(row.co2Tons)}</span>
            </div>
          ))}
        </div>
      </ReportSection>

      <ReportSection eyebrow="S3" title={t.impact.s3Title} lead={t.impact.s3Lead}>
        <Table head={[t.impact.colDate, t.impact.colNgo, t.impact.colCountry, t.impact.colCategory, t.impact.colValue]} align={[false, false, false, false, true]}>
          {report.beneficiaries.map((row) => (
            <tr key={row.matchId} className="border-t border-border">
              <Td>{row.date}</Td>
              <Td>{row.ngoName}</Td>
              <Td>{row.country}</Td>
              <Td>{categoryLabel(row.category, locale)}</Td>
              <Td right>{money(row.valueEur)}</Td>
            </tr>
          ))}
        </Table>
      </ReportSection>

      <ReportSection title={t.impact.geoTitle}>
        <Table head={[t.impact.colCountry, t.impact.colNgos, t.impact.colMatches, t.impact.colValueTransferred]} align={[false, true, true, true]}>
          {report.geoReach.map((row) => (
            <tr key={row.country} className="border-t border-border">
              <Td>{row.country}</Td>
              <Td right>{nf.format(row.ngos)}</Td>
              <Td right>{nf.format(row.matches)}</Td>
              <Td right>{money(row.valueEur)}</Td>
            </tr>
          ))}
        </Table>
      </ReportSection>

      <p className="text-xs leading-6 text-muted-foreground">{t.impact.methodology}</p>
    </div>
  );
}

function Kpi({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div
        className={`text-2xl font-semibold tabular-nums sm:text-3xl ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function ReportSection({
  eyebrow,
  title,
  lead,
  children
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
      {eyebrow ? (
        <p className="text-[11px] font-medium">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-lg font-semibold sm:text-xl">{title}</h2>
      {lead ? <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{lead}</p> : null}
      <div className="mt-4 overflow-x-auto">{children}</div>
    </section>
  );
}

function Table({
  head,
  align,
  children
}: {
  head: string[];
  align: boolean[];
  children: React.ReactNode;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          {head.map((label, index) => (
            <th
              key={label}
              className={`pb-2 text-xs font-medium text-muted-foreground ${align[index] ? "text-right" : "text-left"}`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`py-2.5 align-top ${right ? "text-right tabular-nums" : "text-left"} text-foreground/80`}>{children}</td>;
}

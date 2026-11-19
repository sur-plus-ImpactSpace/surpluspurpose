import { buttonVariants } from "@/components/ui/button";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminDashboard } from "../components/dashboard/AdminDashboard";
import { CorporateDashboard } from "../components/dashboard/CorporateDashboard";
import { NgoDashboard } from "../components/dashboard/NgoDashboard";
import { ImpactReportView } from "../components/dashboard/ImpactReportView";
import { PrintExportButton } from "../components/dashboard/PrintExportButton";
import { WorkspaceShell } from "../components/shell/WorkspaceShell";
import { getDictionary, resolveLocale, type Locale } from "../lib/i18n";
import { loadDemoWorkspaceData, type PulseListing, type WorkspaceRole } from "../lib/workspace-data";
import { DEMO_COOKIE, getSandbox } from "../lib/demo-sandbox";
import { demoAccessAllowed } from "./demo-access";
import type { ImpactReport, PlanTier } from "@surplus/domain";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "sur.plus · Demo workspace"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Public sandbox: always seed data, never Supabase, clearly labeled.
 * Mutations go through the preview route runtime (per-instance, resets) —
 * in production that requires SURPLUS_ALLOW_PREVIEW_MUTATIONS=true.
 *
 * Shares the app shell with the authenticated workspace. The chrome is
 * translated (?lang=de); demo content is not — that is the i18n invariant.
 */
export default async function DemoPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};

  // On a real deployment (Supabase configured) the sandbox is a gated sales
  // tool — not open for competitors to browse. It requires ?key=<token> matching
  // SURPLUS_DEMO_ACCESS_TOKEN; without a configured token it stays closed. A pure
  // demo deployment (no auth backend) has no token and is open by design.
  const key = Array.isArray(params.key) ? params.key[0] : params.key;

  // Each visitor works in their own sandbox. Without a live one they go through
  // the demo's own start page (which also covers an expired sandbox). A live
  // sandbox is only ever issued after the key check (POST /demo/enter), so it
  // also counts as access: the in-page role, language and view links carry no key.
  const sandboxId = (await cookies()).get(DEMO_COOKIE)?.value;
  const sandbox = getSandbox(sandboxId);
  if (!sandbox && !demoAccessAllowed(key)) redirect("/login");
  if (!sandbox) {
    const back = new URLSearchParams();
    if (key) back.set("key", key);
    if (params.lang === "de") back.set("lang", "de");
    if (sandboxId) back.set("expired", "1");
    redirect(`/demo/start${back.size ? `?${back}` : ""}`);
  }

  const role = roleFromParams(params);
  const locale = resolveLocale(params.lang);
  const t = getDictionary(locale);
  const planPreview = planFromParams(params);
  const pulseListing = pulseFromParams(params);
  const view = viewFromParams(params);
  const { actor, data, repository: repo } = loadDemoWorkspaceData(role, { pulseListing, sandbox });
  const identity = { ...WORKSPACE_IDENTITY[actor.role], tier: t.tiers[actor.role] };

  return (
    <WorkspaceShell
      activeRole={actor.role}
      identity={identity}
      locale={locale}
      sidebarFooter={
        <p className="inline-flex items-center gap-2 rounded-md border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          {t.shell.sandbox}
        </p>
      }
      t={t}
      tag={t.platformTag}
      topbarRight={
        <>
          <nav className="flex-shrink-0" aria-label={t.aria.perspective}>
            <div className="flex gap-0.5 rounded-md border bg-muted p-0.5">
              {ROLES.map((item) => {
                const active = item.role === actor.role;

                return (
                  <a
                    aria-current={active ? "page" : undefined}
                    className={`whitespace-nowrap rounded-sm px-2.5 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-3 ${
                      active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                    href={demoHref(item.role, locale)}
                    key={item.role}
                  >
                    <span className="sm:hidden">{item.short}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </a>
                );
              })}
            </div>
          </nav>
        </>
      }
    >
      <div className="border-b border-border bg-card px-5 py-7 sm:px-8">
        {/* The sidebar carries this on lg+; on mobile it would otherwise be lost. */}
        <div className="mb-4 flex items-center gap-2.5 lg:hidden">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary">
            {identity.initials}
          </span>
          <p className="truncate text-sm font-semibold text-foreground">
            {identity.name}
            <span className="ml-2 font-normal text-muted-foreground">{identity.tier}</span>
          </p>
        </div>
        <p className="text-[11px] font-medium text-primary">
          {t.header.eyebrow}
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl leading-tight sm:text-4xl">
          {t.header.titles[actor.role]}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-7 text-muted-foreground">
          {t.header.subtitles[actor.role]}
        </p>

        {pulseListing && actor.role === "corporate" ? (
          <p className="mt-4 max-w-3xl rounded-lg border border-primary bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
            <strong className="font-semibold text-primary">{t.header.pulseLead}</strong>{" "}
            {t.header.pulseBody(pulseListing.quantity, pulseListing.title)}
          </p>
        ) : null}

        <p className="mt-3 max-w-3xl rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
          {t.header.noticeLead}{" "}
          <a
            className="font-semibold text-primary underline-offset-2 hover:underline"
            href="https://calendly.com/florian_surplus/30min"
            rel="noreferrer"
            target="_blank"
          >
            {t.header.noticeBook}
          </a>{" "}
          {t.header.noticeMiddle}{" "}
          <a
            className="font-semibold text-primary underline-offset-2 hover:underline"
            href="https://surpluspurpose.com"
          >
            surpluspurpose.com
          </a>
          .
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            className={buttonVariants({ size: "sm", variant: view !== "impact" ? "default" : "outline" })}
            href={demoViewHref(actor.role, locale, null)}
          >
            {t.header.titles[actor.role].split(" ")[0]} · Dashboard
          </a>
          <a
            className={buttonVariants({ size: "sm", variant: view === "impact" ? "default" : "outline" })}
            href={demoViewHref(actor.role, locale, "impact")}
          >
            {t.nav.impact} &amp; CSRD
          </a>
        </div>
      </div>

      {view === "impact" ? (
        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <p className="text-sm text-muted-foreground">
              {t.impact.eyebrow} · sample data
            </p>
            <PrintExportButton label={t.impact.exportCta} />
          </div>
          <ImpactReportView report={SAMPLE_IMPACT_REPORT} t={t} locale={locale} />
        </div>
      ) : actor.role === "corporate" ? (
        <CorporateDashboard
          actor={actor}
          authConfig={null}
          locale={locale}
          planPreview={planPreview}
          planToggleBasePath="/demo"
          realtimeConfig={null}
          repo={repo}
        />
      ) : actor.role === "ngo" ? (
        <NgoDashboard actor={actor} authConfig={null} data={data} locale={locale} realtimeConfig={null} repo={repo} t={t} />
      ) : (
        <AdminDashboard actor={actor} authConfig={null} data={data} repo={repo} />
      )}
    </WorkspaceShell>
  );
}

/** Role names are product vocabulary (only "Corporate" and "NGO"), so they are
 *  not translated. */
const ROLES: Array<{ role: WorkspaceRole; label: string; short: string }> = [
  { role: "corporate", label: "Corporate", short: "Corp" },
  { role: "ngo", label: "NGO", short: "NGO" },
  { role: "admin", label: "sur.plus Ops", short: "Ops" }
];

/** Demo content — never translated. The tier label is chrome and comes from the
 *  dictionary instead. */
const WORKSPACE_IDENTITY: Record<WorkspaceRole, { name: string; initials: string }> = {
  corporate: { name: "Acme GmbH", initials: "AC" },
  ngo: { name: "Kleiderkammer", initials: "KK" },
  admin: { name: "sur.plus Ops", initials: "SP" },
  editor: { name: "sur.plus Ops (editor)", initials: "ED" }
};

/** Keeps role and language in the URL when either one changes. */
function demoHref(role: WorkspaceRole, locale: Locale): string {
  const query = new URLSearchParams();
  if (role !== "corporate") query.set("role", role);
  if (locale !== "en") query.set("lang", locale);
  const search = query.toString();

  return search ? `/demo?${search}` : "/demo";
}

function roleFromParams(params: SearchParams): WorkspaceRole {
  const raw = params.role;
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === "ngo" || value === "admin" ? value : "corporate";
}

/**
 * Pulse bridge: the impact calculator links here with pt/pc/pq/pv so the
 * visitor sees their own surplus inside the demo workspace. Strictly
 * validated; anything off falls back to the plain demo.
 */
function pulseFromParams(params: SearchParams): PulseListing | undefined {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const title = one(params.pt)?.trim().slice(0, 80);
  const category = one(params.pc)?.trim().slice(0, 60);
  const quantity = Number(one(params.pq));
  const unitValue = Number(one(params.pv));

  if (!title || !category) return undefined;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) return undefined;
  if (!Number.isFinite(unitValue) || unitValue < 0 || unitValue > 1000000) return undefined;

  return { title, category, quantity: Math.round(quantity), unitValue: Math.round(unitValue) };
}

function planFromParams(params: SearchParams): PlanTier | null {
  const raw = params.plan;
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === "tree" || value === "seed" ? value : null;
}

function viewFromParams(params: SearchParams): "impact" | null {
  const raw = params.view;
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value === "impact" ? "impact" : null;
}

/** Keeps role, language and the impact view in the URL together. */
function demoViewHref(role: WorkspaceRole, locale: Locale, view: "impact" | null): string {
  const query = new URLSearchParams();
  if (role !== "corporate") query.set("role", role);
  if (locale !== "en") query.set("lang", locale);
  if (view) query.set("view", view);
  const search = query.toString();

  return search ? `/demo?${search}` : "/demo";
}

/**
 * Sample impact figures for the demo Impact Dashboard — illustrative only, mirrors
 * the aggregate on the landing-page sample report. The authenticated /impact route
 * computes the same shape live from completed matches. Demo content is not
 * translated (i18n invariant); the chrome/labels come from the dictionary.
 */
const SAMPLE_IMPACT_REPORT: ImpactReport = {
  period: null,
  totals: { valueEur: 187400, co2Tons: 11.93, matches: 23, ngos: 23, countries: 5, weightKg: 3840 },
  byCategory: [
    { category: "IT Hardware", units: 344, weightKg: 1840, valueEur: 96000, co2Tons: 3.17 },
    { category: "Textiles", units: 1200, weightKg: 380, valueEur: 47000, co2Tons: 6.12 },
    { category: "Office furniture", units: 220, weightKg: 1620, valueEur: 44400, co2Tons: 2.64 }
  ],
  beneficiaries: [
    { matchId: "s1", date: "2026-05-14", ngoName: "Bildung Digital e.V.", country: "DE", category: "IT Hardware", valueEur: 28800, title: "IT Hardware donation", units: 40, weightKg: 200, co2Tons: 0.5 },
    { matchId: "s2", date: "2026-05-02", ngoName: "Sozialwerk Hamburg gGmbH", country: "DE", category: "Office furniture", valueEur: 16200, title: "Office furniture donation", units: 40, weightKg: 200, co2Tons: 0.5 },
    { matchId: "s3", date: "2026-04-18", ngoName: "Kleiderkammer Łódź", country: "PL", category: "Textiles", valueEur: 14400, title: "Textiles donation", units: 40, weightKg: 200, co2Tons: 0.5 },
    { matchId: "s4", date: "2026-04-03", ngoName: "Stichting Werk Amsterdam", country: "NL", category: "IT Hardware", valueEur: 19200, title: "IT Hardware donation", units: 40, weightKg: 200, co2Tons: 0.5 },
    { matchId: "s5", date: "2026-03-21", ngoName: "Cowork4Good Wien", country: "AT", category: "Office furniture", valueEur: 12000, title: "Office furniture donation", units: 40, weightKg: 200, co2Tons: 0.5 },
    { matchId: "s6", date: "2026-03-07", ngoName: "Tech4Society Stockholm", country: "SE", category: "IT Hardware", valueEur: 22400, title: "IT Hardware donation", units: 40, weightKg: 200, co2Tons: 0.5 }
  ],
  geoReach: [
    { country: "DE", ngos: 9, matches: 10, valueEur: 74200 },
    { country: "PL", ngos: 6, matches: 6, valueEur: 38400 },
    { country: "NL", ngos: 4, matches: 4, valueEur: 31600 },
    { country: "SE", ngos: 2, matches: 2, valueEur: 26800 },
    { country: "AT", ngos: 2, matches: 1, valueEur: 16400 }
  ]
};

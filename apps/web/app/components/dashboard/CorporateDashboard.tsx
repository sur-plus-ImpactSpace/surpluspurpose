import {
  CONTACT_UNLOCK_STATES,
  PLAN_ENTITLEMENTS,
  buildMatchImpactSummaries,
  isCompanyVerified,
  isPaidPlan,
  planAllows,
  type ActorContext,
  type Document,
  type EvidenceRef,
  type Listing,
  type Match,
  type MatchImpactSummary,
  type PlanTier,
  type SurplusRepository
} from "@surplus/domain";
import { InvitationCreatePanel, type InvitationOrgOption } from "../InvitationCreatePanel";
import { CopilotLauncher } from "../CopilotLauncher";
import { SurplusAssistant } from "../SurplusAssistant";
import { AgreementClickwrap } from "../AgreementClickwrap";
import { CompanyVerificationUpload } from "../CompanyVerificationUpload";
import { MatchingPrincipleDemo } from "../MatchingPrincipleDemo";
import { TwoFactorSetup } from "../TwoFactorSetup";
import { ListingCreateForm } from "../ListingCreateForm";
import { SurplusListCopilotUpload } from "../SurplusListCopilotUpload";
import { MatchConfirmControls } from "../MatchConfirmControls";
import { nextMatchActionForRole } from "../match-actions";
import { SAAS_TERMS } from "../../lib/agreements";
import type { Locale } from "../../lib/i18n";
import type { ServiceChatRealtimeConfig, SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import {
  EmptyState,
  EvidencePanel,
  InvitationQueuePanel,
  LogisticsPanel,
  LoopPanel,
  NextStepHero,
  OnboardingWelcome,
  ProfileRow,
  ServicePanel,
  loopData,
  matchStateLabel
} from "./shared";
import { OverviewBento } from "./OverviewBento";

type PlanProfile = {
  key: PlanTier;
  name: string;
  price: string;
  priceNote: string;
  tone: string;
  summary: string;
  proof: string[];
};

// Pricing matches the landing page (single source of truth): annual billing
// gives two months off the monthly price (290 * 10 / 12 = 242, 690 * 10 / 12 = 575).
const plans: PlanProfile[] = [
  {
    key: "seed",
    name: "Seed",
    price: "242 EUR/mo",
    priceNote: "billed annually · 290 EUR/mo with monthly billing",
    tone: "border-primary",
    summary: "Controlled matching for a first annual surplus workflow.",
    proof: ["12 matches per contract year", "2 seats", "CSRD note per match", "Human matching"]
  },
  {
    key: "tree",
    name: "Tree",
    price: "575 EUR/mo",
    priceNote: "billed annually · 690 EUR/mo with monthly billing",
    tone: "border-border",
    summary: "Ongoing surplus operations with priority curation and richer evidence.",
    proof: [
      "Unlimited matches",
      "5 seats",
      "ISAE 3000-ready documents",
      "Impact and employer-branding assets"
    ]
  }
];

export function CorporateDashboard({
  actor,
  authConfig,
  locale,
  planPreview,
  planToggleBasePath = "/",
  realtimeConfig,
  repo
}: {
  actor: Extract<ActorContext, { role: "corporate" }>;
  authConfig: SupabaseBrowserConfig | null;
  locale: Locale;
  planPreview: PlanTier | null;
  /** Route the Seed/Tree preview toggle links back to (e.g. "/demo"). */
  planToggleBasePath?: string;
  realtimeConfig: ServiceChatRealtimeConfig | null;
  repo: SurplusRepository;
}) {
  const company = repo.companies.get(actor.companyId);
  const actualPlan = company?.plan ?? "seed";
  const currentPlan = planPreview ?? actualPlan;
  const entitlement = PLAN_ENTITLEMENTS[currentPlan];
  const committedMatches = repo.companies.countCommittedMatches(actor.companyId, 2026);
  const allowance = entitlement.matchesPerYear;
  const visibleMatches = repo.matches.list(actor);
  const primaryMatch = visibleMatches[0];
  const ngoPreview = primaryMatch ? repo.ngos.getForMatch(primaryMatch.id, actor) : undefined;
  const contactLocked = ngoPreview ? !("contactEmail" in ngoPreview) : true;
  const nextMatchAction = primaryMatch ? nextMatchActionForRole(primaryMatch.state, actor.role) : null;
  const listings = repo.listings.listForCompany(actor.companyId);
  const documents = repo.documents.list(actor);
  const impactSummaries = buildMatchImpactSummaries({
    matches: visibleMatches,
    listings,
    documents
  });
  const logisticsItems = visibleMatches.map((match) => ({
    match,
    title: repo.listings.get(match.listingId)?.title ?? match.id
  }));
  const { activeRun, proposedActions, pendingActionCount } = loopData(repo, actor);
  const messages = primaryMatch ? repo.messages.listForMatch(primaryMatch.id, actor) : [];
  const invitations = repo.invitations.list(actor);
  const members = repo.users.list(actor);
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const inviteOrgOptions: InvitationOrgOption[] = company
    ? [{ id: company.id, label: company.name, role: "corporate" }]
    : [];
  const downloadActor = authConfig ? undefined : actor.userId;
  const isNewWorkspace = listings.length === 0 && visibleMatches.length === 0;
  // A self-registered corporate lands on the free `registered` tier. It may look
  // around and upgrade, but matching stays locked until it activates a paid plan
  // (Seed/Tree). Listing create additionally waits on verification (ADR 0027).
  // Gate on the real company plan, never the preview toggle.
  const isPaid = company ? isPaidPlan(actualPlan) : true;
  const verified = isCompanyVerified(company);

  if (isNewWorkspace) {
    return (
      <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
        {company && !isPaid ? <CompanyPlanBanner plan={actualPlan} /> : null}
        {company && !isPaid ? <MatchingPrincipleDemo perspective="corporate" /> : null}
        <OnboardingWelcome
          steps={[
            "List your first surplus — furniture, IT, textiles or tools.",
            "sur.plus matches it with a verified NGO within 72 hours.",
            "Confirm the match; certificate and CSRD note are generated for you."
          ]}
          subtitle="Your workspace is ready. One listing is all it takes to start the loop."
          title="Turn your first surplus into documented impact"
        />
        {isPaid ? (
          <ListingCreateForm actorUserId={actor.userId} authConfig={authConfig} defaultOpen locale={locale} />
        ) : null}
        <ServicePanel
          actor={actor}
          match={undefined}
          messages={[]}
          realtimeConfig={realtimeConfig}
          role="Corporate"
        />
      </section>
    );
  }

  const nextStep = corporateNextStep(primaryMatch);

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
      {company && !isPaid ? <CompanyPlanBanner plan={actualPlan} /> : null}
      {company && !isPaid ? <MatchingPrincipleDemo perspective="corporate" /> : null}

      <NextStepHero
        body={nextStep.body}
        matchState={primaryMatch?.state}
        cta={
          isPaid && primaryMatch && nextMatchAction ? (
            <MatchConfirmControls
              action={nextMatchAction}
              actorUserId={actor.userId}
              authConfig={authConfig}
              matchId={primaryMatch.id}
              requiresAgreement={
                nextMatchAction.nextState === "both_confirmed"
                  ? { kind: SAAS_TERMS.kind, version: SAAS_TERMS.version, label: SAAS_TERMS.title }
                  : undefined
              }
            />
          ) : undefined
        }
        title={nextStep.title}
        tone={nextStep.tone}
      />

      <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <PlanPreviewToggle actualPlan={actualPlan} basePath={planToggleBasePath} viewPlan={currentPlan} />
        {currentPlan !== actualPlan ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Preview: viewing the <strong>{currentPlan === "tree" ? "Tree" : "Seed"}</strong> workspace — this is what it unlocks.{" "}
            {`Your plan is ${actualPlan === "tree" ? "Tree" : "Seed"}.`}
          </p>
        ) : null}
      </div>

      <OverviewBento
        impactHref="/demo?view=impact"
        journey={[
          { label: "Verify company", done: company?.verificationState === "verified" },
          { label: "List surplus", done: listings.length > 0 },
          { label: "Get matched", done: visibleMatches.length > 0 },
          { label: "Goods delivered", done: visibleMatches.some((match) => match.state === "delivered" || match.state === "completed") },
          { label: "Impact report", done: visibleMatches.some((match) => match.state === "completed") }
        ]}
        matches={visibleMatches}
        repo={repo}
        stats={[
          { label: "Matches", value: allowance === null ? "Unlimited" : `${committedMatches}/${allowance}` },
          { label: "Open listings", value: String(listings.filter((listing) => listing.state === "open").length) },
          { label: "Seats", value: `${members.length + pendingInvitations.length}/${entitlement.userSeats}` },
          { label: "Approval queue", value: `${pendingActionCount} pending` }
        ]}
      />

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[1.2fr_0.8fr]" id="c-workspace">
        <WorkspaceProfile
          contactLocked={contactLocked}
          documents={documents}
          listings={listings}
          match={primaryMatch}
          plan={currentPlan}
        />
        <ServicePanel
          actor={actor}
          match={primaryMatch}
          messages={messages}
          realtimeConfig={realtimeConfig}
          role="Corporate"
        />
      </section>

      {isPaid && verified ? (
        <>
          <ListingCreateForm actorUserId={actor.userId} authConfig={authConfig} locale={locale} />

          <SurplusListCopilotUpload actorUserId={actor.userId} authConfig={authConfig} locale={locale} />
        </>
      ) : null}

      <AgreementClickwrap
        config={authConfig}
        description="Your subscription terms for using sur.plus. Accepting records a versioned, audit-logged acceptance — no separate signature needed. Required before you can confirm a match."
        kind={SAAS_TERMS.kind}
        locale={locale}
        termsHref={SAAS_TERMS.termsHref}
        title={SAAS_TERMS.title}
        version={SAAS_TERMS.version}
      />

      <TwoFactorSetup config={authConfig} locale={locale} />

      {company ? (
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <p
            className="text-xs font-medium"
          >
            Company verification
          </p>
          <h2 className="mt-2 text-xl font-semibold">Verify your company</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Status: <strong>{(company.verificationState ?? "onboarding").replace(/_/g, " ")}</strong>. A
            verified company builds trust with NGOs and Ops.
          </p>
          <CompanyVerificationUpload actorUserId={actor.userId} config={authConfig} />
        </section>
      ) : null}

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[0.95fr_1.05fr]" id="c-evidence">
        <EvidencePanel
          authConfig={authConfig}
          documents={documents}
          downloadActor={downloadActor}
          viewerRole="corporate"
        />
        <ImpactPanel downloadActor={downloadActor} summaries={impactSummaries} />
      </section>

      <LogisticsPanel items={logisticsItems} />

      <CopilotLauncher
        actorUserId={actor.userId}
        authConfig={authConfig}
        matchId={primaryMatch?.id ?? null}
        matchTitle={primaryMatch ? repo.listings.get(primaryMatch.listingId)?.title ?? null : null}
        socialCardsAllowed={planAllows(actualPlan, "social_media_cards")}
      />

      <SurplusAssistant />

      {currentPlan === "tree" ? <TreeShowcasePanel summary={impactSummaries[0] ?? null} /> : null}

      <section className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <LoopPanel actions={proposedActions} actor={actor} authConfig={authConfig} run={activeRun} />
        <UpgradePanel currentPlan={currentPlan} committedMatches={committedMatches} allowance={allowance} />
      </section>

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[1fr_1fr]" id="c-members">
        <InvitationCreatePanel
          actorUserId={actor.userId}
          authConfig={authConfig}
          defaultOrgId={actor.companyId}
          defaultRole="corporate"
          mode="corporate"
          orgOptions={inviteOrgOptions}
        />
        <InvitationQueuePanel
          actorUserId={actor.userId}
          authConfig={authConfig}
          data={repo.snapshot()}
          invitations={invitations}
          members={members}
          seatLimit={entitlement.userSeats}
        />
      </section>

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-4 lg:grid-cols-2" id="c-plans">
        {plans.map((plan) => (
          <PlanCard active={plan.key === currentPlan} key={plan.key} plan={plan} />
        ))}
      </section>
    </section>
  );
}

/**
 * Shown while a corporate is still on the free `registered` tier. Mirrors the
 * NGO verification banner: accent border, eyebrow, headline, explanation and a
 * status pill. Posting surplus and matching stay locked until a paid plan is
 * activated — the plans/upgrade section further down stays visible so they can
 * still upgrade.
 */
function CompanyPlanBanner({ plan }: { plan: PlanTier }) {
  return (
    <section
      className="rounded-xl border-2 bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-medium"
          >
            Plan required
          </p>
          <h2 className="mt-1 text-xl font-semibold">Activate a plan to start matching</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            You can look around your workspace, but posting surplus and matching stay locked until
            you activate a paid plan. Choose Seed or Tree in the plans section below to unlock
            listings, matching and documentation.
          </p>
        </div>
        <span className="inline-flex w-fit items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
          {plan}
        </span>
      </div>
      <a
        className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="#c-plans"
      >
        View plans and upgrade
      </a>
    </section>
  );
}

function PlanPreviewToggle({
  actualPlan,
  basePath,
  viewPlan
}: {
  actualPlan: PlanTier;
  basePath: string;
  viewPlan: PlanTier;
}) {
  const options: Array<{ plan: PlanTier; label: string }> = [
    { plan: "seed", label: "Seed" },
    { plan: "tree", label: "Tree" }
  ];

  return (
    <nav className="inline-flex rounded-lg border border-border bg-muted p-1" aria-label="Preview plan tier">
      {options.map((item) => (
        <a
          className={`rounded px-3 py-1.5 text-sm font-semibold ${
            item.plan === viewPlan ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card"
          }`}
          href={item.plan === actualPlan ? `${basePath}?role=corporate` : `${basePath}?role=corporate&plan=${item.plan}`}
          key={item.plan}
        >
          View as {item.label}
        </a>
      ))}
    </nav>
  );
}

function WorkspaceProfile({
  contactLocked,
  documents,
  listings,
  match,
  plan
}: {
  contactLocked: boolean;
  documents: Document[];
  listings: Listing[];
  match: Match | undefined;
  plan: PlanTier;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">
            Corporate profile · {plan}
          </p>
          {/* Shared with the authenticated workspace — no demo wording here. */}
          <h2 className="mt-2 text-xl font-semibold">Your surplus, matched and documented</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Seed stays focused on controlled matches. Tree is the natural upgrade once volume,
            priority matching and audit-ready assets matter.
          </p>
        </div>
        <span className="rounded-lg border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {match?.state.replace("_", " ") ?? "No match"}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ProfileRow label="Listings" value={`${listings.length} demo records`} detail={listings[0]?.title ?? "No listing"} />
        <ProfileRow label="Evidence" value={`${documents.length} files`} detail="Report, certificate, tracker and upload slots" />
        <ProfileRow
          label="Trust boundary"
          value={contactLocked ? "Locked" : "Unlocked"}
          detail={`Contact unlock begins at ${CONTACT_UNLOCK_STATES[0]}`}
        />
      </div>
    </section>
  );
}

function ImpactPanel({
  downloadActor,
  summaries
}: {
  downloadActor?: string;
  summaries: MatchImpactSummary[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-muted-foreground">
        Impact and evidence
      </p>
      <h2 className="mt-2 text-xl font-semibold">Your matches, documented</h2>
      {summaries.length === 0 ? (
        <EmptyState
          className="mt-5"
          hint="CO₂e saved, social value and the CSRD note are computed from real match data — never estimated."
          next="List surplus to get your first match"
          title="No impact figures yet"
        />
      ) : (
        <div className="mt-5 grid gap-3">
          {summaries.map((summary) => (
            <ImpactSummaryCard downloadActor={downloadActor} key={summary.matchId} summary={summary} />
          ))}
        </div>
      )}
    </section>
  );
}

function ImpactSummaryCard({
  downloadActor,
  summary
}: {
  downloadActor?: string;
  summary: MatchImpactSummary;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-muted">
      <ImpactIllustration category={summary.category} />
      <div className="p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm font-semibold">{summary.headline}</p>
        <p className="text-xs font-medium text-muted-foreground">
          Score {summary.score} · {matchStateLabel(summary.state)}
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ImpactFigure label="CO2e avoided" value={`${summary.co2Tons} t`} />
        <ImpactFigure
          label="Goods"
          value={summary.quantity === null ? "—" : `${summary.quantity} ${summary.unit ?? ""}`.trim()}
        />
        <ImpactFigure
          label="Estimated value"
          value={summary.estimatedValueEur === null ? "—" : `€${summary.estimatedValueEur.toLocaleString("en-US")}`}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <EvidenceBadge downloadActor={downloadActor} evidence={summary.certificate} noun="Certificate" />
        <EvidenceBadge downloadActor={downloadActor} evidence={summary.csrdNote} noun="CSRD note" />
      </div>
      </div>
    </article>
  );
}

type IllustrationKind = "it" | "furniture" | "textiles" | "generic";

function illustrationKind(category: string | null): IllustrationKind {
  // `category` is the stable catalog id (e.g. "it_electronics"). Map the ids
  // with a dedicated illustration; everything else falls back to "generic".
  // The regex still catches any legacy free-text label as a safety net.
  const value = (category ?? "").toLowerCase();
  if (value === "it_electronics" || /(it|electronic|laptop|computer)/.test(value)) return "it";
  if (value === "office_furniture" || /(furniture|desk|chair|office)/.test(value)) return "furniture";
  if (value === "textiles_clothing" || /(textile|cloth|workwear|jacket)/.test(value)) return "textiles";

  return "generic";
}

/**
 * Decorative, category-matched line illustration. Deliberately not stock
 * photography: brand-toned SVG keeps the panel calm, loads nothing external
 * and stays honest about being an illustrative example.
 */
function ImpactIllustration({ category }: { category: string | null }) {
  const kind = illustrationKind(category);

  return (
    <div aria-hidden className="flex h-20 items-center justify-center border-b border-border bg-muted">
      <svg
        className="h-12 w-auto text-primary"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        viewBox="0 0 96 48"
      >
        {kind === "it" ? (
          <>
            <rect height="22" rx="2" width="36" x="30" y="8" />
            <path d="M24 36h48l-4-6H28l-4 6Z" />
            <path d="M42 14h12M42 19h8" opacity="0.5" />
          </>
        ) : kind === "furniture" ? (
          <>
            <path d="M22 20h52M28 20v16M68 20v16" />
            <path d="M40 20v-6h16v6" opacity="0.5" />
            <path d="M24 36h8M64 36h8" opacity="0.5" />
          </>
        ) : kind === "textiles" ? (
          <>
            <path d="M48 10c-3 0-5 2-8 2l-10 5 4 8 5-2v15h18V23l5 2 4-8-10-5c-3 0-5-2-8-2Z" />
            <path d="M48 10v10" opacity="0.5" />
          </>
        ) : (
          <>
            <path d="M30 18l18-8 18 8-18 8-18-8Z" />
            <path d="M30 18v14l18 8 18-8V18" />
            <path d="M48 26v14" opacity="0.5" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * Tree-only value made visible in the plan preview: exactly what the landing
 * page promises for Tree, shown as concrete artifacts instead of bullet text.
 */
function TreeShowcasePanel({ summary }: { summary: MatchImpactSummary | null }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">
        Included in Tree
      </p>
      <h2 className="mt-2 text-xl font-semibold">Audit-grade evidence and visibility</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-semibold">Green procurement certificate</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Annual certificate for public tenders, issued from your audited match record.
          </p>
          <span className="mt-3 inline-block rounded-lg border border-primary bg-muted px-2 py-1 text-xs font-semibold text-primary">
            Issued yearly
          </span>
        </article>
        <article className="rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-semibold">Social-media impact card</p>
          {summary ? (
            <div className="mt-2 rounded-sm bg-primary p-3 text-primary-foreground">
              <p className="text-xs opacity-80">{summary.headline}</p>
              <p className="mt-1 text-lg font-semibold">{summary.co2Tons} t CO2e avoided</p>
              <p className="text-xs opacity-80">
                {summary.quantity ?? "—"} {summary.unit ?? ""} · with a verified NGO
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Ready-to-post cards from your real match figures.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Drafted by the Copilot, approved by you.</p>
        </article>
        <article className="rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-semibold">Employer-branding dashboard</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Impact figures and stories, shareable with your team and candidates.
          </p>
        </article>
        <article className="rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-semibold">Weekly impact newsletter</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Impact summary and matching NGO needs, every week in your inbox.
          </p>
        </article>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        ISAE 3000-ready documentation and the full audit trail are included in every Tree
        match.
      </p>
    </section>
  );
}

function ImpactFigure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-primary">{value}</p>
    </div>
  );
}

function EvidenceBadge({
  downloadActor,
  evidence,
  noun
}: {
  downloadActor?: string;
  evidence: EvidenceRef;
  noun: string;
}) {
  const styles: Record<EvidenceRef["status"], string> = {
    ready: "border-primary bg-muted text-primary",
    in_progress: "border-border bg-muted text-muted-foreground",
    pending: "border-border bg-card text-muted-foreground"
  };
  const labels: Record<EvidenceRef["status"], string> = {
    ready: `${noun} ready`,
    in_progress: `${noun} in preparation`,
    pending: `${noun} pending`
  };
  const actorQuery = downloadActor ? `?actor=${encodeURIComponent(downloadActor)}` : "";
  const href =
    evidence.status === "ready" && evidence.documentId
      ? `/api/documents/${encodeURIComponent(evidence.documentId)}/download${actorQuery}`
      : null;

  if (href) {
    return (
      <a
        className={`rounded-sm border px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline ${styles.ready}`}
        href={href}
        rel="noreferrer"
        target="_blank"
        title={evidence.title ?? undefined}
      >
        {labels.ready} &darr;
      </a>
    );
  }

  return (
    <span
      className={`rounded-sm border px-2 py-1 text-xs font-semibold ${styles[evidence.status]}`}
      title={evidence.title ?? undefined}
    >
      {labels[evidence.status]}
    </span>
  );
}

function UpgradePanel({
  allowance,
  committedMatches,
  currentPlan
}: {
  allowance: number | null;
  committedMatches: number;
  currentPlan: PlanTier;
}) {
  const seedUsage = allowance === null ? 0 : Math.min(100, Math.round((committedMatches / allowance) * 100));

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">
        Seed to Tree
      </p>
      <h2 className="mt-2 text-xl font-semibold">Upgrade signal without pressure</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Tree becomes relevant when matches, service intensity and audit assets grow beyond the Seed rhythm.
      </p>
      <div className="mt-5 h-2 overflow-hidden rounded-sm bg-muted">
        <div className="h-full rounded-sm bg-primary" style={{ width: `${currentPlan === "tree" ? 100 : seedUsage}%` }} />
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <UpgradeRow label="Seed" value={allowance === null ? "Unlimited" : `${committedMatches}/${allowance} matches used`} />
        <UpgradeRow label="Tree" value="Unlimited matches · priority matching · richer evidence assets" />
      </div>
    </section>
  );
}

function UpgradeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 rounded-lg border border-border bg-muted px-3 py-2">
      <span className="font-semibold">{label}</span>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}

function PlanCard({ active, plan }: { active: boolean; plan: PlanProfile }) {
  return (
    <article className={`rounded-xl border-t-4 ${plan.tone} border-x border-b border-border bg-card p-5 shadow-xs`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{plan.name}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.summary}</p>
        </div>
        {active ? (
          <span className="rounded-sm bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-5 text-3xl font-semibold">{plan.price}</p>
      <p className="mt-1 text-xs text-muted-foreground">{plan.priceNote}</p>
      <ul className="mt-5 grid gap-2 text-sm">
        {plan.proof.map((item) => (
          <li className="flex gap-2" key={item}>
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** Turns the primary match state into the corporate's single next step. */
function corporateNextStep(match: Match | undefined): {
  body: string;
  title: string;
  tone: "act" | "wait" | "done";
} {
  if (!match) {
    return {
      tone: "wait",
      title: "We are finding your match",
      body: "sur.plus is matching your listed surplus with verified NGOs. Your next step appears here as soon as there is a match."
    };
  }

  switch (match.state) {
    case "ngo_confirmed":
      return {
        tone: "act",
        title: "Confirm your match",
        body: "The NGO confirmed. Confirm to lock the match — this uses one of your yearly matches and unlocks the NGO's contact details."
      };
    case "both_confirmed":
      return {
        tone: "wait",
        title: "Pickup is being arranged",
        body: "Both sides confirmed. sur.plus is scheduling pickup and delivery — follow it in Logistics below."
      };
    case "in_transit":
      return {
        tone: "wait",
        title: "Your surplus is on the way",
        body: "The goods are in transit to the NGO. Receipt confirmation will complete the match."
      };
    case "delivered":
      return {
        tone: "wait",
        title: "Awaiting receipt confirmation",
        body: "Delivered. The NGO is confirming receipt — once they do, your certificate and CSRD note are generated."
      };
    case "completed":
      return {
        tone: "done",
        title: "Documented impact is ready",
        body: "The match is complete. Your donation certificate and CSRD note are ready in Documents."
      };
    case "expired":
      return {
        tone: "wait",
        title: "This proposal expired",
        body: "It was not confirmed within 14 days and used none of your matches. Your surplus is available again."
      };
    case "failed":
      return {
        tone: "wait",
        title: "Delivery failed",
        body: "Delivery did not work out. If that was not the NGO's doing, your match is credited back."
      };
    case "cancelled":
      return {
        tone: "wait",
        title: "This match was cancelled",
        body: "No further action on it. List more surplus to start a new match."
      };
    default:
      return {
        tone: "wait",
        title: "Waiting for the NGO to confirm",
        body: "An NGO was matched to your surplus and is confirming interest. Your step shows up here next."
      };
  }
}

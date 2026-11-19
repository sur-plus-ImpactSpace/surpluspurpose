import {
  buildMatchImpactSummaries,
  isNgoVerified,
  type ActorContext,
  type Match,
  type RepositoryData,
  type SurplusRepository
} from "@surplus/domain";
import { AgreementClickwrap } from "../AgreementClickwrap";
import { DonationAllocationReleaseControls } from "../DonationAllocationReleaseControls";
import { MatchConfirmControls } from "../MatchConfirmControls";
import { NgoAuthorizationForm } from "../NgoAuthorizationForm";
import { nextMatchActionForRole } from "../match-actions";
import { NGO_PARTNER_AGREEMENT } from "../../lib/agreements";
import type { Locale } from "../../lib/i18n";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import { NextStepHero, OnboardingWelcome, VerificationNotice } from "./shared";
import { OverviewBento } from "./OverviewBento";
import { NgoDownloadsPanel } from "./NgoDownloadsPanel";

/**
 * The authenticated NGO overview (`/`) as a scannable cockpit — symmetric to
 * CorporateCockpit. One focal next-step card, a KPI row, an at-a-glance grid
 * that links into the dedicated routes (/matches, /inbox, /needs, /documents,
 * /impact, /account), quick actions, the partner-agreement clickwrap and
 * certificate-authorisation details that gate counter-signing, plus the starter
 * package. The long panel scroll stays in NgoDashboard for the public /demo.
 */
export function NgoCockpit({
  actor,
  authConfig,
  data,
  locale,
  repo
}: {
  actor: Extract<ActorContext, { role: "ngo" }>;
  authConfig: SupabaseBrowserConfig | null;
  data: RepositoryData;
  locale: Locale;
  repo: SurplusRepository;
}) {
  const ngo = data.ngos.find((item) => item.id === actor.ngoId);
  const verified = isNgoVerified(ngo);
  const needs = repo.needs.listForNgo(actor.ngoId);
  const openNeeds = needs.filter((need) => need.state === "open").length;
  const matches = repo.matches.list(actor);
  const primaryMatch = matches[0];
  const nextMatchAction = primaryMatch ? nextMatchActionForRole(primaryMatch.state, actor.role) : null;
  const documents = repo.documents.list(actor);
  const readyDocuments = documents.filter(
    (document) => document.status === "approved" || document.status === "published"
  ).length;
  const messages = primaryMatch ? repo.messages.listForMatch(primaryMatch.id, actor) : [];
  const members = repo.users.list(actor);
  const impact = buildMatchImpactSummaries({ matches, listings: data.listings, documents })[0] ?? null;
  // Labels come from the allocation snapshot (0071): the NGO cannot read
  // donation_positions / donation_cases under RLS.
  const allocationRows = repo.donationAllocations.listForNgo(actor.ngoId).map((allocation) => ({
    ...allocation,
    positionLabel: allocation.positionModel
  }));

  const isNewWorkspace = needs.length === 0 && matches.length === 0;
  if (isNewWorkspace) {
    return (
      <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
        {verified ? null : <VerificationNotice organization="NGO" />}
        <OnboardingWelcome
          steps={[
            "Post what your organization needs — quantity, place, who benefits.",
            "sur.plus matches verified corporate surplus to your need.",
            "Confirm fit and receipt; goods and documentation arrive together."
          ]}
          subtitle={
            verified
              ? "Your workspace is ready. Posting a need is the fastest way to receive goods."
              : "While Ops reviews your organisation you can save needs as drafts — they go live after verification."
          }
          title="Receive verified surplus for your mission"
        />
        {/* Ops can allocate to an NGO before it posts a need or has a match. */}
        <DonationAllocationReleaseControls
          actorUserId={actor.userId}
          allocations={allocationRows}
          authConfig={authConfig}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickAction
            href="/needs"
            label={verified ? "Post your first need" : "Save a draft need"}
            primary
          />
          <QuickAction href="/inbox" label="Open your inbox" />
        </div>
        <NgoAiStarterCard />
        <section className="scroll-mt-24 lg:scroll-mt-20" id="n-downloads">
          <NgoDownloadsPanel />
        </section>
      </section>
    );
  }

  const nextStep = ngoNextStep(primaryMatch);

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
      {verified ? null : <VerificationNotice organization="NGO" />}
      <NextStepHero
        body={nextStep.body}
        matchState={primaryMatch?.state}
        cta={
          primaryMatch && nextMatchAction ? (
            <MatchConfirmControls
              action={nextMatchAction}
              actorUserId={actor.userId}
              authConfig={authConfig}
              matchId={primaryMatch.id}
              requiresAgreement={
                nextMatchAction.nextState === "completed"
                  ? {
                      kind: NGO_PARTNER_AGREEMENT.kind,
                      version: NGO_PARTNER_AGREEMENT.version,
                      label: NGO_PARTNER_AGREEMENT.title
                    }
                  : undefined
              }
            />
          ) : undefined
        }
        title={nextStep.title}
        tone={nextStep.tone}
      />

      <DonationAllocationReleaseControls
        actorUserId={actor.userId}
        allocations={allocationRows}
        authConfig={authConfig}
      />

      <OverviewBento
        impactHref="/impact"
        journey={[
          { label: "Get verified", done: verified },
          { label: "Post a need", done: needs.length > 0 },
          { label: "Get matched", done: matches.length > 0 },
          { label: "Receive goods", done: matches.some((match) => match.state === "delivered" || match.state === "completed") },
          { label: "Confirm receipt", done: matches.some((match) => match.state === "completed") }
        ]}
        matches={matches}
        repo={repo}
        stats={[
          { label: "Verification", value: ngo?.verificationState.replace(/_/g, " ") ?? "Unknown" },
          { label: "Open needs", value: String(openNeeds) },
          { label: "Incoming goods", value: String(matches.length) },
          { label: "Members", value: String(members.length) }
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlanceCard
          href="/matches"
          title="Incoming goods"
          value={primaryMatch ? matchStateText(primaryMatch.state) : "No incoming goods"}
          hint="Track pickup, delivery and confirm receipt."
        />
        <GlanceCard
          href="/inbox"
          title="Inbox"
          value={messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : "No messages yet"}
          hint="Every match conversation in one place."
        />
        <GlanceCard
          href="/needs"
          title="Needs"
          value={`${needs.length} posted · ${openNeeds} open`}
          hint="Post what your organization needs."
        />
        <GlanceCard
          href="/documents"
          title="Documents"
          value={readyDocuments ? `${readyDocuments} ready` : "None yet"}
          hint="Donation certificates and receipts."
        />
        <GlanceCard
          href="/impact"
          title="Impact"
          value={impact ? `${impact.co2Tons} t CO₂e avoided` : "No impact yet"}
          hint="The documented impact of goods you received."
        />
        <GlanceCard
          href="/account"
          title="Account"
          value={`Free · ${members.length} member${members.length === 1 ? "" : "s"}`}
          hint="Profile, security and team."
        />
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickAction href="/needs" label="Post a need" primary />
        <QuickAction href="/inbox" label="Open inbox" />
        <QuickAction href="#n-downloads" label="Starter package" />
      </div>

      <NgoAiStarterCard />

      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <p className="text-xs font-medium">
          Certificate authorisation
        </p>
        <h2 className="mt-2 text-xl font-semibold">Your donation-receipt details</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          These identify your organisation on every donation certificate you counter-sign — registry
          number, Freistellungsbescheid and the authorised signer.
        </p>
        {ngo?.proofValidUntil ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Verification proof valid until <span className="font-medium text-foreground">{ngo.proofValidUntil}</span>
            {ngo.proofNoticeDate
              ? ` (notice ${ngo.proofNoticeDate}${
                  ngo.proofAssessmentPeriodYears != null
                    ? ` · ${ngo.proofAssessmentPeriodYears} year assessment period`
                    : ""
                })`
              : ""}
            .
          </p>
        ) : null}
        {ngo ? (
          <div className="mt-4">
            <NgoAuthorizationForm
              config={authConfig}
              initial={{
                registryNumber: ngo.registryNumber ?? "",
                taxAuthorizationRef: ngo.taxAuthorizationRef ?? "",
                taxAuthorizationDate: ngo.taxAuthorizationDate ?? "",
                taxOffice: ngo.taxOffice ?? "",
                authorizedSigner: ngo.authorizedSigner ?? "",
                authorizedSignerRole: ngo.authorizedSignerRole ?? ""
              }}
            />
          </div>
        ) : null}
      </section>

      <AgreementClickwrap
        config={authConfig}
        description="The partnership terms for receiving goods via sur.plus. Accepting records a versioned, audit-logged acceptance — no separate signature needed. Required before you can counter-sign a donation certificate."
        kind={NGO_PARTNER_AGREEMENT.kind}
        locale={locale}
        termsHref={NGO_PARTNER_AGREEMENT.termsHref}
        title={NGO_PARTNER_AGREEMENT.title}
        version={NGO_PARTNER_AGREEMENT.version}
      />

      <section className="scroll-mt-24 lg:scroll-mt-20" id="n-downloads">
        <NgoDownloadsPanel />
      </section>
    </section>
  );
}

/**
 * Partner perk: free, informal AI-starter orientation for NGOs. Deliberately
 * modest framing — not "consulting", no legal advice; credible because the
 * founder builds with AI daily.
 */
function NgoAiStarterCard() {
  return (
    <section className="rounded-xl border border-border bg-muted p-5 shadow-xs">
      <p className="text-xs font-medium text-primary">Partner perk · free</p>
      <h2 className="mt-2 text-xl font-semibold">AI starter help for your team</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        As a sur.plus partner you get informal, practical pointers for getting started with everyday AI
        tools — ChatGPT, Claude &amp; co. for communications, grant applications and documentation. Not
        technical consulting: honest orientation from someone who builds with AI every day.
      </p>
      <a
        className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        href="https://calendly.com/florian_surplus/30min"
        rel="noreferrer"
        target="_blank"
      >
        Book a free 30-min session
      </a>
    </section>
  );
}

function GlanceCard({ href, title, value, hint }: { href: string; title: string; value: string; hint: string }) {
  return (
    <a
      className="group rounded-xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-primary"
      href={href}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">
          {title}
        </p>
        <span aria-hidden className="text-muted-foreground transition-colors group-hover:text-primary">
          &rarr;
        </span>
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{hint}</p>
    </a>
  );
}

function QuickAction({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  const base =
    "flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold shadow-xs transition-colors";
  const tone = primary
    ? "bg-primary text-primary-foreground hover:opacity-90"
    : "border border-border bg-card text-foreground hover:border-primary";
  return (
    <a className={`${base} ${tone}`} href={href}>
      {label}
    </a>
  );
}

function matchStateText(state: Match["state"]): string {
  return state.replace(/_/g, " ");
}

/** Turns the primary match state into the NGO's single next step. */
function ngoNextStep(match: Match | undefined): {
  body: string;
  title: string;
  tone: "act" | "wait" | "done";
} {
  if (!match) {
    return {
      tone: "wait",
      title: "Post what you need",
      body: "Add a need and sur.plus matches it with corporate surplus. Your next step shows up here as soon as there is a match."
    };
  }

  switch (match.state) {
    case "proposed":
      return {
        tone: "act",
        title: "Confirm you can use this",
        body: "A corporate surplus was matched to your need. Confirm interest to move it forward — the corporate then locks the match."
      };
    case "ngo_confirmed":
      return {
        tone: "wait",
        title: "Waiting for the corporate to confirm",
        body: "You confirmed. The corporate is locking the match — nothing to do yet. Their confirmation unlocks direct contact."
      };
    case "both_confirmed":
      return {
        tone: "wait",
        title: "Pickup is being arranged",
        body: "Both sides confirmed. sur.plus is scheduling pickup and delivery — track it in Matches."
      };
    case "in_transit":
      return {
        tone: "wait",
        title: "Your goods are on the way",
        body: "The surplus is in transit. Once it arrives, confirm receipt to complete the match and generate the documents."
      };
    case "delivered":
      return {
        tone: "act",
        title: "Confirm you received it",
        body: "The delivery is marked as arrived. Confirm receipt to complete the match — this generates the donation certificate and CSRD note."
      };
    case "completed":
      return {
        tone: "done",
        title: "Received and documented",
        body: "The match is complete and the paperwork is filed. Thank you — the impact is recorded."
      };
    case "expired":
      return {
        tone: "wait",
        title: "This proposal expired",
        body: "It was not confirmed within 14 days. Your need stays open for the next proposal."
      };
    case "failed":
      return {
        tone: "wait",
        title: "Delivery failed",
        body: "Delivery did not work out. Ops reviews what happened and will get in touch."
      };
    case "cancelled":
      return {
        tone: "wait",
        title: "This match was cancelled",
        body: "No further action on it. Post more needs to start a new match."
      };
    default:
      return {
        tone: "wait",
        title: "Match in progress",
        body: "Follow the status in Matches."
      };
  }
}

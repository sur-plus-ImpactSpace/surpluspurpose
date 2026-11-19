import {
  type ActorContext,
  type Match,
  type Need,
  type Ngo,
  type RepositoryData,
  type SurplusRepository
} from "@surplus/domain";
import { InvitationCreatePanel, type InvitationOrgOption } from "../InvitationCreatePanel";
import { MatchConfirmControls } from "../MatchConfirmControls";
import { nextMatchActionForRole } from "../match-actions";
import { AgreementClickwrap } from "../AgreementClickwrap";
import { TwoFactorSetup } from "../TwoFactorSetup";
import { NeedCreateForm } from "../NeedCreateForm";
import { NgoAuthorizationForm } from "../NgoAuthorizationForm";
import { NgoVerificationUpload } from "../NgoVerificationUpload";
import { MatchingPrincipleDemo } from "../MatchingPrincipleDemo";
import { SurplusAssistant } from "../SurplusAssistant";
import { NgoDownloadsPanel } from "./NgoDownloadsPanel";
import { CategoryResourcesPanel } from "./CategoryResourcesPanel";
import { NGO_PARTNER_AGREEMENT } from "../../lib/agreements";
import type { Dictionary, Locale } from "../../lib/i18n";
import type { ServiceChatRealtimeConfig, SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import {
  EvidencePanel,
  InvitationQueuePanel,
  LogisticsPanel,
  LoopPanel,
  NeedPanel,
  NextStepHero,
  OnboardingWelcome,
  ProfileRow,
  ServicePanel,
  loopData
} from "./shared";
import { OverviewBento } from "./OverviewBento";

export function NgoDashboard({
  actor,
  authConfig,
  data,
  locale,
  realtimeConfig,
  repo,
  t
}: {
  actor: Extract<ActorContext, { role: "ngo" }>;
  authConfig: SupabaseBrowserConfig | null;
  data: RepositoryData;
  locale: Locale;
  realtimeConfig: ServiceChatRealtimeConfig | null;
  repo: SurplusRepository;
  t: Dictionary;
}) {
  const ngo = data.ngos.find((item) => item.id === actor.ngoId);
  const needs = repo.needs.listForNgo(actor.ngoId);
  const matches = repo.matches.list(actor);
  const documents = repo.documents.list(actor);
  const primaryMatch = matches[0];
  const incomingCategory = primaryMatch
    ? data.listings.find((listing) => listing.id === primaryMatch.listingId)?.category ?? null
    : null;
  const nextMatchAction = primaryMatch ? nextMatchActionForRole(primaryMatch.state, actor.role) : null;
  const { activeRun, proposedActions, pendingActionCount } = loopData(repo, actor);
  const messages = primaryMatch ? repo.messages.listForMatch(primaryMatch.id, actor) : [];
  const invitations = repo.invitations.list(actor);
  const members = repo.users.list(actor);
  const inviteOrgOptions: InvitationOrgOption[] = ngo
    ? [{ id: ngo.id, label: ngo.name, role: "ngo" }]
    : [];
  const logisticsItems = matches.map((match) => ({
    match,
    title: repo.listings.get(match.listingId)?.title ?? match.id
  }));
  const isNewWorkspace = needs.length === 0 && matches.length === 0;
  // Unverified NGOs may look around, but the real functions (posting needs,
  // matching) stay locked until Ops verifies them — surfaced by a status banner.
  const isVerified = ngo?.verificationState === "verified";

  if (isNewWorkspace) {
    return (
      <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
        {ngo && !isVerified ? (
          <NgoVerificationBanner actorUserId={actor.userId} authConfig={authConfig} ngo={ngo} />
        ) : null}
        {ngo && !isVerified ? <MatchingPrincipleDemo perspective="ngo" /> : null}
        <OnboardingWelcome
          steps={[
            "Post what your organization needs — quantity, place, who benefits.",
            "sur.plus matches verified corporate surplus to your need.",
            "Confirm fit and receipt; goods and documentation arrive together."
          ]}
          subtitle="Your workspace is ready. Posting a need is the fastest way to receive goods."
          title="Receive verified surplus for your mission"
        />
        {isVerified ? (
          <NeedCreateForm actorUserId={actor.userId} authConfig={authConfig} defaultOpen locale={locale} />
        ) : null}
        {/* A brand-new NGO is exactly the audience for the starter package. */}
        <section className="scroll-mt-24 lg:scroll-mt-20" id="n-downloads">
          <NgoDownloadsPanel />
        </section>
        <NgoAiStarterCard />
        <SurplusAssistant />
        <ServicePanel
          actor={actor}
          match={undefined}
          messages={[]}
          realtimeConfig={realtimeConfig}
          role="NGO"
        />
      </section>
    );
  }

  const nextStep = ngoNextStep(primaryMatch);

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
      {ngo && !isVerified ? (
        <NgoVerificationBanner actorUserId={actor.userId} authConfig={authConfig} ngo={ngo} />
      ) : null}
      {ngo && !isVerified ? <MatchingPrincipleDemo perspective="ngo" /> : null}

      <NextStepHero
        body={nextStep.body}
        matchState={primaryMatch?.state}
        cta={
          isVerified && primaryMatch && nextMatchAction ? (
            <MatchConfirmControls
              action={nextMatchAction}
              actorUserId={actor.userId}
              authConfig={authConfig}
              matchId={primaryMatch.id}
            />
          ) : undefined
        }
        title={nextStep.title}
        tone={nextStep.tone}
      />

      <OverviewBento
        impactHref="/demo?role=ngo&view=impact"
        journey={[
          { label: "Get verified", done: isVerified },
          { label: "Post a need", done: needs.length > 0 },
          { label: "Get matched", done: matches.length > 0 },
          { label: "Receive goods", done: matches.some((match) => match.state === "delivered" || match.state === "completed") },
          { label: "Confirm receipt", done: matches.some((match) => match.state === "completed") }
        ]}
        matches={matches}
        repo={repo}
        stats={[
          { label: "Verification", value: ngo?.verificationState.replace("_", " ") ?? "Unknown" },
          { label: "Open needs", value: String(needs.filter((need) => need.state === "open").length) },
          { label: "Incoming goods", value: String(matches.length) },
          { label: "Members", value: String(members.length) },
          { label: "Approval queue", value: `${pendingActionCount} pending` }
        ]}
      />

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[1fr_1fr]" id="n-workspace">
        <NgoProfilePanel ngo={ngo} needs={needs} matches={matches} />
        <ServicePanel
          actor={actor}
          match={primaryMatch}
          messages={messages}
          realtimeConfig={realtimeConfig}
          role="NGO"
        />
      </section>

      {isVerified ? <NeedCreateForm actorUserId={actor.userId} authConfig={authConfig} locale={locale} /> : null}

      <CategoryResourcesPanel category={incomingCategory} locale={locale} t={t} />

      <NgoAiStarterCard />

      <SurplusAssistant />

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[0.95fr_1.05fr]" id="n-evidence">
        <NeedPanel needs={needs} locale={locale} matches={matches} />
        {ngo ? (
          <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <p
              className="text-xs font-medium"
            >
              Certificate authorisation
            </p>
            <h2 className="mt-2 text-xl font-semibold">Your donation-receipt details</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These identify your organisation on every donation certificate you counter-sign —
              registry number, Freistellungsbescheid and the authorised signer.
            </p>
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
          </section>
        ) : null}

        <AgreementClickwrap
          config={authConfig}
          description="The partnership terms for receiving goods via sur.plus. Accepting records a versioned, audit-logged acceptance — no separate signature needed. Required before you can counter-sign a donation certificate."
          kind={NGO_PARTNER_AGREEMENT.kind}
          locale={locale}
          termsHref={NGO_PARTNER_AGREEMENT.termsHref}
          title={NGO_PARTNER_AGREEMENT.title}
          version={NGO_PARTNER_AGREEMENT.version}
        />

        <TwoFactorSetup config={authConfig} locale={locale} />

        <EvidencePanel
          authConfig={authConfig}
          documents={documents}
          downloadActor={authConfig ? undefined : actor.userId}
          viewerRole="ngo"
        />
      </section>

      <LogisticsPanel items={logisticsItems} />

      <section className="scroll-mt-24 lg:scroll-mt-20" id="n-downloads">
        <NgoDownloadsPanel />
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <LoopPanel
          actions={proposedActions}
          actor={actor}
          authConfig={authConfig}
          emptyText="When sur.plus proposes receipt checks, logistics confirmations or impact drafts for this NGO, they appear here before execution."
          emptyTitle="Loop ready for NGO approvals"
          run={activeRun}
        />
        <NgoTrustPanel ngo={ngo} />
      </section>

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[1fr_1fr]" id="n-members">
        <InvitationCreatePanel
          actorUserId={actor.userId}
          authConfig={authConfig}
          defaultOrgId={actor.ngoId}
          defaultRole="ngo"
          mode="ngo"
          orgOptions={inviteOrgOptions}
        />
        <InvitationQueuePanel
          actorUserId={actor.userId}
          authConfig={authConfig}
          data={data}
          invitations={invitations}
          members={members}
        />
      </section>
    </section>
  );
}

/**
 * Partner perk: free, informal AI-starter orientation for NGOs. Deliberately
 * modest framing — not "consulting", no data-protection/legal advice, no
 * guaranteed outcomes; credible because the founder builds with AI daily.
 * "Superficial but valuable from an NGO's point of view."
 */
function NgoAiStarterCard() {
  return (
    <section className="rounded-xl border border-border bg-muted p-5 shadow-xs">
      <p className="text-xs font-medium text-primary">
        Partner perk · free
      </p>
      <h2 className="mt-2 text-xl font-semibold">AI starter help for your team</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        As a sur.plus partner you get informal, practical pointers for getting started with everyday
        AI tools — ChatGPT, Claude &amp; co. for communications, grant applications and documentation.
        Not technical consulting: honest orientation from someone who builds with AI every day.
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

function NgoProfilePanel({
  matches,
  needs,
  ngo
}: {
  matches: Match[];
  needs: Need[];
  ngo: Ngo | undefined;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-muted-foreground">
        NGO workspace
      </p>
      <h2 className="mt-2 text-xl font-semibold">{ngo?.name ?? "Verified NGO"}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        NGOs do not see Corporate plan pricing. The workspace prioritizes verification,
        need posts, incoming goods and receipt confirmations.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <ProfileRow label="Focus" value={ngo?.focus ?? "Needs"} detail={`${ngo?.city ?? "Workspace"} · ${ngo?.country ?? "EU"}`} />
        <ProfileRow label="Needs" value={`${needs.length} posts`} detail={needs[0]?.title ?? "No need posted"} />
        <ProfileRow label="Incoming" value={`${matches.length} matches`} detail={matches[0]?.state.replace("_", " ") ?? "No incoming goods"} />
      </div>
    </section>
  );
}

function NgoTrustPanel({ ngo }: { ngo: Ngo | undefined }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">
        Verification boundary
      </p>
      <h2 className="mt-2 text-xl font-semibold">Trust before contact unlock</h2>
      <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
        <OpsRow label="Status" value={ngo?.verificationState.replace("_", " ") ?? "Unknown"} />
        <OpsRow label="Trust score" value={ngo ? `${ngo.trustScore}/100` : "Not scored"} />
        <OpsRow label="Capacity proof" value="Upload and review stay visible before matching scales." />
      </div>
    </section>
  );
}

function OpsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <p className="font-semibold text-foreground">{label}</p>
      <p className="mt-1 leading-5">{value}</p>
    </div>
  );
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
        body: "Both sides confirmed. sur.plus is scheduling pickup and delivery — track it in Logistics below."
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
        body: "Follow the status below."
      };
  }
}

function NgoVerificationBanner({
  actorUserId,
  authConfig,
  ngo
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  ngo: Ngo;
}) {
  const status = ngo.verificationState.replace(/_/g, " ");
  const isRejected = ngo.verificationState === "rejected";
  // The proof is normally submitted during registration. It's only asked for
  // here as a fallback (onboarding without a proof) or when Ops sent it back
  // for more info; otherwise the NGO is simply waiting for the Ops review.
  const needsProof = ngo.verificationState === "onboarding" || ngo.verificationState === "pending_info";
  return (
    <section
      className="rounded-xl border-2 bg-card p-5 shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="text-xs font-medium"
          >
            {needsProof ? "Verification pending" : "In review"}
          </p>
          <h2 className="mt-1 text-xl font-semibold">Limited access until we verify you</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            {needsProof
              ? "You can look around your workspace, but posting needs and matching stay locked until Ops verifies your organisation. Upload your eligibility proof to start the review."
              : "Your eligibility proof is in — Ops is reviewing it. You can look around, but posting needs and matching unlock once you're verified."}
          </p>
        </div>
        <span className="inline-flex w-fit items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
          {status}
        </span>
      </div>
      <NgoVerificationProgress state={ngo.verificationState} isRejected={isRejected} />
      {needsProof ? (
        <NgoVerificationUpload actorUserId={actorUserId} config={authConfig} orgType={ngo.orgType} />
      ) : (
        <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
          Nothing to do right now — we&#39;ll email you when the review is complete.
        </p>
      )}
    </section>
  );
}

const VERIFICATION_STEPS = [
  { key: "registered", label: "Registered" },
  { key: "proof", label: "Proof submitted" },
  { key: "review", label: "In review" },
  { key: "verified", label: "Verified" }
] as const;

/**
 * Maps the raw NGO verification state machine onto the 4-station stepper.
 * onboarding -> 0 (Registered)
 * verification_pending -> 1 (Proof submitted)
 * pending_info / review -> 2 (In review)
 * verified -> 3 (Verified)
 * rejected is handled separately (off-path terminal state).
 */
function currentStepIndex(state: Ngo["verificationState"]): number {
  switch (state) {
    case "onboarding":
      return 0;
    case "verification_pending":
      return 1;
    case "pending_info":
    case "review":
      return 2;
    case "verified":
      return 3;
    default:
      return 0;
  }
}

function NgoVerificationProgress({
  state,
  isRejected
}: {
  state: Ngo["verificationState"];
  isRejected: boolean;
}) {
  if (isRejected) {
    return (
      <div
        className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3"
        role="status"
      >
        <span aria-hidden className="mt-0.5 text-muted-foreground" style={{ color: "#d4712a" }}>
          &#9888;
        </span>
        <div>
          <p className="text-sm font-semibold text-muted-foreground" style={{ color: "#b45a1e" }}>
            Verification rejected
          </p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Ops could not verify your organisation with the documents provided. Re-upload corrected
            eligibility proof below, or reach out to support to continue.
          </p>
        </div>
      </div>
    );
  }

  const current = currentStepIndex(state);
  const needsInfo = state === "pending_info";

  return (
    <div className="mt-4 overflow-x-auto">
      <ol className="flex min-w-[420px] items-start gap-0" aria-label="Verification progress">
        {VERIFICATION_STEPS.map((step, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;
          const stepLabel =
            needsInfo && index === 2 ? "Needs info" : step.label;

          const circleClass = isComplete
            ? "border-primary bg-primary text-primary-foreground"
            : isCurrent
              ? "border-primary bg-muted text-primary"
              : "border-border bg-card text-muted-foreground";

          const textClass = isComplete
            ? "text-primary"
            : isCurrent
              ? "text-primary font-semibold"
              : "text-muted-foreground";

          return (
            <li
              key={step.key}
              className="flex flex-1 flex-col items-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              <div className="flex w-full items-center">
                {/* left connector */}
                <span
                  aria-hidden
                  className={`h-0.5 flex-1 ${index === 0 ? "opacity-0" : index <= current ? "bg-primary" : "bg-border"}`}
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${circleClass}`}
                >
                  {isComplete ? (
                    <span aria-hidden>&#10003;</span>
                  ) : (
                    <span aria-hidden>{index + 1}</span>
                  )}
                </span>
                {/* right connector */}
                <span
                  aria-hidden
                  className={`h-0.5 flex-1 ${index === VERIFICATION_STEPS.length - 1 ? "opacity-0" : index < current ? "bg-primary" : "bg-border"}`}
                />
              </div>
              <span className={`mt-1.5 text-center text-xs leading-4 ${textClass}`}>
                {stepLabel}
                {isCurrent ? <span className="sr-only"> (current step)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

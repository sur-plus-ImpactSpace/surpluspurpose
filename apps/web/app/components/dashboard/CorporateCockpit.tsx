import {
  PLAN_ENTITLEMENTS,
  buildMatchImpactSummaries,
  isCompanyVerified,
  needQuantityLabel,
  type ActorContext,
  type Match,
  type OpenNeedRow,
  type PlanTier,
  type SurplusRepository
} from "@surplus/domain";
import { AgreementClickwrap } from "../AgreementClickwrap";
import { CompanyCheckForm } from "../CompanyCheckForm";
import { CompanyVerificationUpload } from "../CompanyVerificationUpload";
import { MatchConfirmControls } from "../MatchConfirmControls";
import { nextMatchActionForRole } from "../match-actions";
import { SAAS_TERMS } from "../../lib/agreements";
import type { Locale } from "../../lib/i18n";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import { NextStepHero, OnboardingWelcome, VerificationNotice, loopData } from "./shared";
import { OverviewBento } from "./OverviewBento";

/**
 * The authenticated corporate overview (`/`) as a scannable cockpit — not the
 * long panel scroll (that stays in CorporateDashboard, which the public /demo
 * showcase still uses). One focal "what needs you now" card, a KPI row, an
 * at-a-glance grid that links into the dedicated routes (/matches, /inbox,
 * /listings, /documents, /impact), and the clickwrap that gates match
 * confirmation. Details live in their own routes; this page orients.
 */
export function CorporateCockpit({
  actor,
  authConfig,
  locale,
  openNeeds,
  repo
}: {
  actor: Extract<ActorContext, { role: "corporate" }>;
  authConfig: SupabaseBrowserConfig | null;
  locale: Locale;
  openNeeds?: OpenNeedRow[] | null;
  repo: SurplusRepository;
}) {
  const company = repo.companies.get(actor.companyId);
  const verified = isCompanyVerified(company);
  // Fail closed. An unknown plan used to fall back to "seed" — a paying tier —
  // which handed full entitlements to anyone whose company row was missing.
  const plan: PlanTier = company?.plan ?? "registered";
  const entitlement = PLAN_ENTITLEMENTS[plan];
  const committedMatches = repo.companies.countCommittedMatches(actor.companyId, 2026);
  const allowance = entitlement.matchesPerYear;
  const matches = repo.matches.list(actor);
  const primaryMatch = matches[0];
  const nextMatchAction = primaryMatch ? nextMatchActionForRole(primaryMatch.state, actor.role) : null;
  const listings = repo.listings.listForCompany(actor.companyId);
  const openListings = listings.filter((listing) => listing.state === "open").length;
  const documents = repo.documents.list(actor);
  const readyDocuments = documents.filter(
    (document) => document.status === "approved" || document.status === "published"
  ).length;
  const { pendingActionCount } = loopData(repo, actor);
  const messages = primaryMatch ? repo.messages.listForMatch(primaryMatch.id, actor) : [];
  const invitations = repo.invitations.list(actor);
  const members = repo.users.list(actor);
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const impact = buildMatchImpactSummaries({ matches, listings, documents })[0] ?? null;

  // Browse-only when unverified (ADR 0027) or on the free registered plan
  // (no contact / no match entitlement). Listing create also waits on verification.
  const planBrowseOnly = !entitlement.ngoContactAccess;
  const browseOnly = !verified || planBrowseOnly;

  const isNewWorkspace = listings.length === 0 && matches.length === 0;
  if (isNewWorkspace) {
    return (
      <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
        {verified ? null : (
        <VerificationNotice organization="company">
          {company?.verificationState === "rejected" ? null : (
            <>
              <CompanyCheckForm actorUserId={actor.userId} authConfig={authConfig} companyId={actor.companyId} />
              <CompanyVerificationUpload actorUserId={actor.userId} config={authConfig} />
            </>
          )}
        </VerificationNotice>
      )}
        <OnboardingWelcome
          steps={
            !verified
              ? [
                  "Browse what verified NGOs need right now — anonymised.",
                  "Complete company verification so Ops can unlock listing and matching.",
                  "After verification, list surplus and get matched with certificate and CSRD note."
                ]
              : planBrowseOnly
                ? [
                    // A registered corporate has no match allowance, so promising a
                    // match here would be a lie the plan cannot honour.
                    "Browse what verified NGOs need right now — anonymised.",
                    "Choose Seed or Tree to see who is behind a need, make contact and match.",
                    "Every match then generates its certificate and CSRD note for you."
                  ]
                : [
                    "List your first surplus — furniture, IT, textiles or tools.",
                    "sur.plus matches it with a verified NGO within 72 hours.",
                    "Confirm the match; certificate and CSRD note are generated for you."
                  ]
          }
          subtitle={
            !verified
              ? "Your application is in. Browse the network while Ops verifies your company."
              : planBrowseOnly
                ? "You are registered. Here is what the verified network needs right now."
                : "Your workspace is ready. One listing is all it takes to start the loop."
          }
          title={
            !verified
              ? "Browse only until your company is verified"
              : planBrowseOnly
                ? "See the demand before you commit"
                : "Turn your first surplus into documented impact"
          }
        />
        {browseOnly ? (
          <NgoDemandPanel canList={verified} rows={openNeeds ?? []} unverified={!verified} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAction href="/cases" label="Open your first donation case" primary />
            <QuickAction href="/inbox" label="Open your inbox" />
          </div>
        )}
      </section>
    );
  }

  const nextStep = corporateNextStep(primaryMatch, { browseOnly, verified });

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
      {verified ? null : (
        <VerificationNotice organization="company">
          {company?.verificationState === "rejected" ? null : (
            <>
              <CompanyCheckForm actorUserId={actor.userId} authConfig={authConfig} companyId={actor.companyId} />
              <CompanyVerificationUpload actorUserId={actor.userId} config={authConfig} />
            </>
          )}
        </VerificationNotice>
      )}
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

      {/*
        The browse directory is the registered tier's main surface. It used to
        render only in the empty-workspace branch, so the moment a registered
        company listed anything (the E2E account did exactly that) it vanished.
      */}
      {browseOnly ? (
        <NgoDemandPanel canList={verified} rows={openNeeds ?? []} unverified={!verified} />
      ) : null}

      <OverviewBento
        impactHref="/impact"
        journey={[
          { label: "Verify company", done: verified },
          { label: "List surplus", done: listings.length > 0 },
          { label: "Get matched", done: matches.length > 0 },
          { label: "Goods delivered", done: matches.some((match) => match.state === "delivered" || match.state === "completed") },
          { label: "Impact report", done: matches.some((match) => match.state === "completed") }
        ]}
        matches={matches}
        repo={repo}
        stats={[
          { label: "Matches", value: allowance === null ? "Unlimited" : `${committedMatches}/${allowance}` },
          { label: "Open listings", value: String(openListings) },
          { label: "Seats", value: `${members.length + pendingInvitations.length}/${entitlement.userSeats}` },
          { label: "Approval queue", value: `${pendingActionCount} pending` }
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlanceCard
          href="/matches"
          title="Active match"
          value={primaryMatch ? matchStateText(primaryMatch.state) : "No active match"}
          hint="Pickup, delivery and the auditable conversation."
        />
        <GlanceCard
          href="/inbox"
          title="Inbox"
          value={messages.length ? `${messages.length} message${messages.length === 1 ? "" : "s"}` : "No messages yet"}
          hint="Every match conversation in one place."
        />
        <GlanceCard
          href="/listings"
          title="Listings"
          value={`${listings.length} listed · ${openListings} open`}
          hint={verified ? "List surplus and track what is matched." : "Listing unlocks after company verification."}
        />
        <GlanceCard
          href="/documents"
          title="Documents"
          value={readyDocuments ? `${readyDocuments} ready` : "None yet"}
          hint="Certificates and CSRD notes from completed matches."
        />
        <GlanceCard
          href="/impact"
          title="Impact"
          value={impact ? `${impact.co2Tons} t CO₂e avoided` : "No impact yet"}
          hint="Live, audit-ready — export as an ESRS report."
        />
        <GlanceCard
          href="/account"
          title="Account"
          value={`${PLAN_LABEL[plan]} · ${members.length} member${members.length === 1 ? "" : "s"}`}
          hint="Profile, security, team and plan."
        />
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {verified ? <QuickAction href="/listings" label="List surplus" primary /> : (
          <QuickAction href="/account" label="Complete verification" primary />
        )}
        <QuickAction href="/inbox" label="Open inbox" />
        <QuickAction href="/impact" label="View impact" />
      </div>

      <AgreementClickwrap
        config={authConfig}
        description="Your subscription terms for using sur.plus. Accepting records a versioned, audit-logged acceptance — no separate signature needed. Required before you can confirm a match."
        kind={SAAS_TERMS.kind}
        locale={locale}
        termsHref={SAAS_TERMS.termsHref}
        title={SAAS_TERMS.title}
        version={SAAS_TERMS.version}
      />
    </section>
  );
}

function GlanceCard({
  href,
  title,
  value,
  hint
}: {
  href: string;
  title: string;
  value: string;
  hint: string;
}) {
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

/**
 * The needs directory a browse-only corporate sees — anonymised (founder call,
 * 2026-07-16). Each row is the need plus "Verified NGO · focus · country".
 * The RPC has no name column, so nothing here can leak one. Unverified
 * companies stay browse-only until Ops verifies (ADR 0027); registered plans
 * unlock identity, contact and matching with Seed or Tree.
 */
function NgoDemandPanel({
  canList,
  rows,
  unverified
}: {
  canList: boolean;
  rows: OpenNeedRow[];
  unverified: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <p className="text-xs font-medium text-primary">
        Verified NGO network
      </p>
      <h2 className="mt-2 text-xl font-semibold">
        {rows.length > 0 ? "Open needs right now" : "No open needs at the moment"}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {rows.length > 0
          ? unverified
            ? "Anonymised while your company is under review. Listing surplus, who is behind each need, direct contact and matching unlock after Ops verifies you."
            : "Anonymised while you are registered. The organisation behind each need, direct contact and the coordinated handover — with certificate and CSRD note — unlock with Seed or Tree."
          : "Needs from verified NGOs appear here as they are posted."}
      </p>

      {rows.length > 0 ? (
        <ul className="mt-5 grid gap-2">
          {rows.map((row) => (
            <li
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-muted px-4 py-3"
              key={row.needId}
            >
              <span className="text-sm text-foreground/80">
                {row.title}
                <span className="text-muted-foreground"> · {needQuantityLabel(row, row.quantityRemaining)}</span>
                <span className="text-muted-foreground"> → </span>
                <span className="font-medium">
                  Verified NGO{row.ngoFocus ? ` · ${row.ngoFocus}` : ""}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {row.ngoCountry ?? row.country ?? "EU"}
                {row.urgency === "asap" ? " · urgent" : row.urgency === "ongoing" ? " · ongoing" : ""}
                {row.deliveryPreference ? ` · ${row.deliveryPreference}` : ""}
                {row.maxQuantityPerMatch ? ` · max ${row.maxQuantityPerMatch}/match` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <QuickAction
          href="/account"
          label={unverified ? "Complete company verification" : "Unlock who, contact and matching"}
          primary
        />
        {canList ? <QuickAction href="/listings" label="List your surplus" /> : null}
      </div>
    </section>
  );
}

const PLAN_LABEL: Record<PlanTier, string> = {
  registered: "Registered",
  seed: "Seed",
  tree: "Tree"
};

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

/** Turns the primary match state into the corporate's single next step. */
function corporateNextStep(
  match: Match | undefined,
  options: { browseOnly: boolean; verified: boolean }
): {
  body: string;
  title: string;
  tone: "act" | "wait" | "done";
} {
  const { browseOnly, verified } = options;
  if (!match) {
    if (!verified) {
      return {
        tone: "wait",
        title: "Browse only until your company is verified",
        body: "You can look at anonymised NGO needs. Listing surplus, matching and contact details unlock after Ops verifies your company."
      };
    }
    // A registered company has a match allowance of zero. "We are finding
    // your match" would promise work the plan cannot deliver — the E2E
    // walkthrough showed exactly that hero to an unpaid account with one
    // listing. Tell the truth instead: the listing is saved, matching starts
    // with a plan.
    if (browseOnly) {
      return {
        tone: "wait",
        title: "Your listing is saved — matching starts with a plan",
        body: "Browse what verified NGOs need and keep listing. Choose Seed or Tree and we start matching your surplus, with the certificate and CSRD note included."
      };
    }

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
        body: "Both sides confirmed. sur.plus is scheduling pickup and delivery — follow it in Matches."
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

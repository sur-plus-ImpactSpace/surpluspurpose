import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReactNode } from "react";
import {
  needOpenQuantity,
  needQuantityLabel,
  type ActorContext,
  type AgentProposedAction,
  type AgentRun,
  type Document,
  type Invitation,
  type InvitationDeliveryAttempt,
  type Listing,
  type Match,
  type Message,
  type Need,
  type RepositoryData,
  type SignatureEnvelope,
  type SurplusRepository,
  type User
} from "@surplus/domain";
import { AgentActionControls } from "../AgentActionControls";
import { InvitationRevokeControls } from "../InvitationRevokeControls";
import { MemberRemoveControls } from "../MemberRemoveControls";
import { CertificateConfirmControls } from "../CertificateConfirmControls";
import { EvidenceUpload } from "../EvidenceUpload";
import { PhotoUpload } from "../PhotoUpload";
import { SignatureControls } from "../SignatureControls";
import { ServiceChatComposer } from "../ServiceChatComposer";
import type { ServiceChatRealtimeConfig, SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import type { WorkspaceRole } from "../../lib/workspace-data";
import { categoryLabel, subcategoryLabel } from "../../lib/catalog";
import type { Locale } from "../../lib/i18n";

export function roleLabel(role: WorkspaceRole): string {
  if (role === "admin") return "sur.plus Ops";
  if (role === "editor") return "sur.plus Ops (editor)";
  if (role === "corporate") return "Corporate";

  return "NGO";
}

export function loopData(repo: SurplusRepository, actor: ActorContext) {
  const runs = repo.agentRuns.list(actor);
  const activeRun = runs[0];
  const proposedActions = activeRun ? repo.proposedActions.listForRun(activeRun.id, actor) : [];

  return {
    activeRun,
    proposedActions,
    pendingActionCount: proposedActions.filter((action) => action.status === "pending").length
  };
}

/**
 * Empty state (B3). Never a bare sentence: an empty panel says what it is for,
 * why it is empty, and — where one exists — what to do next. The dashed border
 * distinguishes "nothing here yet" from a card that failed to load.
 */
export function EmptyState({
  className = "",
  next,
  title
}: {
  className?: string;
  /** Explanatory sentence callers still pass; it is no longer shown (the title and next step are enough). */
  hint?: string;
  next?: string;
  title: string;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border bg-muted p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {next ? (
        <p className="mt-2.5 text-xs font-medium text-primary">
          {next}
        </p>
      ) : null}
    </div>
  );
}

export type NextStepTone = "act" | "wait" | "done";

/**
 * "Your next step" hero (R4 main-screen redesign). The role overviews lead with
 * the single next step and its action instead of a wall of equal panels. Tone
 * adapts: clay/act when it is the user's turn, calm while waiting, green when
 * done. Shared by every role dashboard, so the framing lands on the
 * authenticated workspace and the public /demo alike.
 */
/**
 * Shown to a company or NGO that Ops has not verified yet. Browsing works;
 * acting (list/match/contact/docs) waits for verification, whatever the plan
 * (ADR 0027 / REQ-AUTH-01).
 */
export function VerificationNotice({
  children,
  organization
}: {
  children?: ReactNode;
  organization: "company" | "NGO";
}) {
  const orgLabel = organization === "NGO" ? "organization" : "company";
  return (
    <section
      className="rounded-xl border border-border bg-muted px-5 py-4 text-sm leading-6 text-muted-foreground"
      role="status"
    >
      <p className="font-semibold text-foreground">Browse only until your {orgLabel} is verified</p>
      <p className="mt-1">
        {organization === "company"
          ? "You can look at anonymised NGO needs. Listing surplus, matching, contact details and documents unlock once Ops has verified your company."
          : "You can save needs as drafts. Matching, contact details and documents unlock once Ops has verified your organization."}{" "}
        Upload your proof in{" "}
        <a className="font-semibold text-primary hover:underline" href="/account">
          Account
        </a>{" "}
        if you have not yet.
      </p>
      {children}
    </section>
  );
}

export function NextStepHero({
  body,
  cta,
  matchState,
  title,
  tone
}: {
  body: string;
  cta?: ReactNode;
  /** The primary match's state; when set, the hero shows where it is in the lifecycle. */
  matchState?: Match["state"];
  title: string;
  tone: NextStepTone;
}) {
  const frameClass =
    tone === "done"
      ? "border-primary/30 bg-primary/5"
      : tone === "wait"
        ? "border-border bg-card"
        : "border-amber-500/40 bg-amber-500/10";

  return (
    <section className={`rounded-xl border ${frameClass} p-5 shadow-xs sm:p-6`}>
      <p className="text-xs font-medium text-muted-foreground">Your next step</p>
      <h2 className="mt-2 text-2xl font-semibold leading-tight">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
      {matchState ? <MatchStepper className="mt-5" state={matchState} /> : null}
      {cta ? <div className="mt-4">{cta}</div> : null}
    </section>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
    </div>
  );
}

/** Corporate surplus listings, with quantity, category and estimated value. */
export function ListingPanel({
  actorUserId,
  authConfig,
  listings,
  locale
}: {
  /** When set with authConfig, each listing gets a photo uploader. */
  actorUserId?: string;
  authConfig?: SupabaseBrowserConfig | null;
  listings: Listing[];
  locale: Locale;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-primary">
        Surplus listings
      </p>
      <h2 className="mt-2 text-xl font-semibold">What you have listed</h2>
      {listings.length === 0 ? (
        <EmptyState
          className="mt-5"
          hint="List surplus — furniture, IT, textiles or tools — and sur.plus matches it with a verified NGO within 72 hours."
          next="Add your first listing below"
          title="No listings yet"
        />
      ) : (
        <div className="mt-5 grid gap-3">
          {listings.map((listing) => (
            <div className="rounded-lg border border-border bg-muted p-3" key={listing.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{listing.title}</p>
                <span className="rounded-sm bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
                  {listing.state.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {listing.quantity} {listing.unit || "units"} · {categoryLabel(listing.category, locale)}
                {listing.subcategory ? ` · ${subcategoryLabel(listing.category, listing.subcategory, locale)}` : ""}
                {listing.weightKg ? ` · ${listing.weightKg} kg` : ""}
                {listing.city ? ` · ${listing.city}` : ""}
              </p>
              {listing.unitValue ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Est. value ~€{(listing.unitValue * listing.quantity).toLocaleString("en")} ·{" "}
                  {listing.quantity} × €{listing.unitValue}
                </p>
              ) : null}
              {listing.categoryDetails ? (
                <p className="mt-1 text-xs text-muted-foreground">{listing.categoryDetails}</p>
              ) : null}
              {listing.photos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {listing.photos.slice(0, 6).map((url, index) => (
                    <img
                      alt={`${listing.title} — photo ${index + 1}`}
                      className="h-16 w-16 rounded-md border border-border object-cover"
                      key={url}
                      src={url}
                    />
                  ))}
                </div>
              ) : null}
              {authConfig !== undefined && actorUserId ? (
                <PhotoUpload actorUserId={actorUserId} config={authConfig} listingId={listing.id} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** NGO need posts — what the NGO can receive. */
export function NeedPanel({
  needs,
  locale,
  matches = []
}: {
  needs: Need[];
  locale: Locale;
  /** The NGO's matches: each is one company's part of a need, so the panel can show what is still open. */
  matches?: Match[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-muted-foreground">
        Need posts
      </p>
      <h2 className="mt-2 text-xl font-semibold">What the NGO can receive</h2>
      {needs.length === 0 ? (
        <EmptyState
          className="mt-5"
          hint="Post what your NGO can use and sur.plus matches it with corporate surplus."
          next="Add your first need below"
          title="No needs posted yet"
        />
      ) : (
        <div className="mt-5 grid gap-3">
          {needs.map((need) => (
            <div className="rounded-lg border border-border bg-muted p-3" key={need.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{need.title}</p>
                <span
                  className={`rounded-sm px-2 py-1 text-xs font-medium ${
                    need.state === "draft"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : "bg-card text-muted-foreground"
                  }`}
                >
                  {need.state === "draft" ? "draft · not live yet" : need.state}
                </span>
              </div>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {needQuantityLabel(need, matches.some((match) => match.needId === need.id) ? needOpenQuantity(need, matches) : null)}
                {need.maxQuantityPerMatch ? ` · max ${need.maxQuantityPerMatch}/match` : ""}{" "}
                · {need.beneficiaries} beneficiaries · {categoryLabel(need.category, locale)}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {need.targetGroup || "—"} · {need.deliveryPreference}
                {need.hasVehicle ? " · vehicle" : ""} · {need.deliveryAddress || "—"}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ProfileRow({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted p-4">
      <p className="text-[11px] font-medium text-primary">{label}</p>
      <p className="mt-2 text-lg font-semibold capitalize text-foreground">{value}</p>
      <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

export function ServicePanel({
  actor,
  authConfig,
  match,
  messages,
  realtimeConfig,
  role
}: {
  actor: Extract<ActorContext, { role: "corporate" | "ngo" }>;
  /** When provided, enables per-match evidence upload (C4). Omitted on the
   *  overview dashboards, which only surface the conversation. */
  authConfig?: SupabaseBrowserConfig | null;
  match: Match | undefined;
  messages: Message[];
  realtimeConfig: ServiceChatRealtimeConfig | null;
  role: "Corporate" | "NGO";
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium">
        Match conversation
      </p>
      <h2 className="mt-2 text-xl font-semibold">Message the other party</h2>
      {match ? (
        <>
          <ServiceChatComposer
            actorUserId={actor.userId}
            counterpartyLabel={role === "Corporate" ? "NGO" : "Corporate"}
            initialMessages={messages}
            matchId={match.id}
            realtimeConfig={realtimeConfig}
            roleLabel={role}
          />
          {authConfig !== undefined ? (
            <EvidenceUpload actorUserId={actor.userId} config={authConfig} matchId={match.id} />
          ) : null}
        </>
      ) : (
        <EmptyState
          className="mt-4"
          hint="The conversation opens with your first match and keeps logistics, document review and contact unlock decisions in one auditable place."
          next="A match opens this conversation"
          title="No conversation yet"
        />
      )}
    </section>
  );
}

export function EvidencePanel({
  actorUserId,
  authConfig,
  documents,
  downloadActor,
  envelopes = [],
  viewerRole
}: {
  actorUserId?: string;
  authConfig?: SupabaseBrowserConfig | null;
  documents: Document[];
  /** E-signature envelopes the viewer may see; their status comes from DocuSeal's webhook only. */
  envelopes?: SignatureEnvelope[];
  /** Preview only: seed actor forwarded to the download route (?actor=). */
  downloadActor?: string;
  /** Enables the NGO countersign action / corporate pending state (0008). */
  viewerRole?: WorkspaceRole;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium">
        Evidence and documents
      </p>
      <h2 className="mt-2 text-xl font-semibold">Certificates, reports and proof</h2>

      {documents.length === 0 ? (
        <EmptyState
          className="mt-5"
          hint="The donation certificate and the CSRD note are generated from a completed match — never estimated."
          next="Complete a match to generate them"
          title="No documents yet"
        />
      ) : (
        <div className="mt-5 grid gap-3">
          {documents.slice(0, 5).map((document) => (
            <DocumentRow
              actorUserId={actorUserId}
              authConfig={authConfig}
              document={document}
              downloadActor={downloadActor}
              envelope={envelopes.find((item) => item.documentId === document.id && item.state !== "voided")}
              key={document.id}
              viewerRole={viewerRole}
            />
          ))}
        </div>
      )}

      {/*
        Evidence upload (C4) lives per-match in the conversation, not here in the
        workspace-wide documents list — so point at it rather than duplicate it.
      */}
      <p className="mt-4 rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm leading-6 text-muted-foreground">
        To add your own files — delivery notes, handover photos — open the match conversation and use
        “Attach evidence”. Uploads stay private to that match and remain auditable.
      </p>
    </section>
  );
}

function DocumentRow({
  actorUserId,
  authConfig,
  document,
  downloadActor,
  envelope,
  viewerRole
}: {
  actorUserId?: string;
  authConfig?: SupabaseBrowserConfig | null;
  document: Document;
  downloadActor?: string;
  envelope?: SignatureEnvelope;
  viewerRole?: WorkspaceRole;
}) {
  const href = documentDownloadHref(document, downloadActor);
  const awaitingCountersign = document.kind === "certificate" && document.status === "in_review";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-muted p-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <p className="font-semibold">{document.title}</p>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          {document.kind.replace("_", " ")} · {document.status.replace("_", " ")}
        </p>
        {document.kind === "certificate" && authConfig !== undefined && actorUserId && (envelope || viewerRole === "admin") ? (
          <SignatureControls
            actorUserId={actorUserId}
            authConfig={authConfig}
            canSend={viewerRole === "admin" && (document.status === "approved" || document.status === "published")}
            documentId={document.id}
            envelope={envelope}
          />
        ) : null}
      </div>
      {awaitingCountersign ? (
        viewerRole === "ngo" && authConfig !== undefined ? (
          <CertificateConfirmControls config={authConfig} documentId={document.id} />
        ) : (
          <span className="rounded-sm bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Awaiting NGO countersign
          </span>
        )
      ) : href ? (
        <a
          className="rounded-sm bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
          href={href}
          rel="noreferrer"
          target="_blank"
        >
          Open
        </a>
      ) : (
        <span className="rounded-sm bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {document.mime?.split("/").at(-1) ?? "file"}
        </span>
      )}
    </div>
  );
}

/**
 * Downloadable when: an uploaded evidence file exists (streamed via signed URL),
 * or a generated document (certificate, CSRD note) is approved/published. A
 * certificate awaiting NGO countersign (in_review) has no storagePath and is not
 * yet ready, so it stays gated until the NGO confirms it.
 */
export function documentDownloadHref(document: Document, downloadActor?: string): string | null {
  const isUpload = Boolean(document.storagePath);
  const generatedReady =
    (document.kind === "certificate" || document.kind === "report") &&
    (document.status === "approved" || document.status === "published");
  if (!isUpload && !generatedReady) return null;
  const actorQuery = downloadActor ? `?actor=${encodeURIComponent(downloadActor)}` : "";

  return `/api/documents/${encodeURIComponent(document.id)}/download${actorQuery}`;
}

/**
 * First-visit welcome card: shown while a workspace has no operational data
 * yet, so the first action is guided instead of a wall of empty panels.
 */
export function OnboardingWelcome({
  steps,
  subtitle,
  title
}: {
  steps: string[];
  subtitle: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-primary/30 bg-primary/5 p-6">
      <p className="text-xs font-medium text-primary">
        Welcome to sur.plus
      </p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li className="rounded-lg border border-primary/30 bg-card p-3" key={step}>
            <p className="text-lg font-semibold text-primary">{index + 1}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const MATCH_STEPS: Array<{ state: Match["state"]; label: string }> = [
  { state: "proposed", label: "Proposed" },
  { state: "ngo_confirmed", label: "NGO confirmed" },
  { state: "both_confirmed", label: "Both confirmed" },
  { state: "in_transit", label: "In transit" },
  { state: "delivered", label: "Delivered" },
  { state: "completed", label: "Completed" }
];

/**
 * The match lifecycle as a stepper: done steps filled, the current one ringed.
 * Closed matches (cancelled, expired, failed) have no forward path, so no stepper.
 */
export function MatchStepper({
  className = "",
  compact = false,
  state
}: {
  className?: string;
  /** Circles only, with just the current step named: for narrow cards. */
  compact?: boolean;
  state: Match["state"];
}) {
  const current = MATCH_STEPS.findIndex((step) => step.state === state);
  if (current === -1) return null;

  return (
    <ol aria-label="Match progress" className={`flex items-start overflow-x-auto pb-1 ${className}`}>
      {MATCH_STEPS.map((step, index) => {
        const done = index < current || state === "completed";
        const active = index === current && state !== "completed";

        return (
          <li
            aria-current={active ? "step" : undefined}
            className={`flex flex-1 flex-col items-center text-center ${compact ? "min-w-0" : "min-w-[84px]"}`}
            key={step.state}
          >
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${index === 0 ? "opacity-0" : done || active ? "bg-primary" : "bg-border"}`} />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary bg-background text-primary" : "border bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check aria-hidden="true" size={14} strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={`h-0.5 flex-1 ${
                  index === MATCH_STEPS.length - 1 ? "opacity-0" : done ? "bg-primary" : "bg-border"
                }`}
              />
            </div>
            {compact && !active ? null : (
              <span
                className={`mt-2 text-xs leading-tight ${active ? "font-semibold" : done ? "opacity-80" : "opacity-45"} ${compact ? "whitespace-nowrap" : ""}`}
              >
                {step.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function matchStateLabel(state: Match["state"]): string {
  return state.replace(/_/g, " ");
}

export type LogisticsItem = {
  match: Match;
  title: string;
};

const CLOSED_STATES: Array<Match["state"]> = ["cancelled", "expired", "failed"];

const STATE_TONE: Partial<Record<Match["state"], string>> = {
  both_confirmed: "border-primary/40 bg-primary/10 text-primary",
  in_transit: "border-primary/40 bg-primary/10 text-primary",
  delivered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  failed: "border-destructive/30 bg-destructive/10 text-destructive"
};

export function LogisticsPanel({ items }: { items: LogisticsItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup and delivery</CardTitle>
      </CardHeader>
      <CardContent className={items.length ? "px-0" : undefined}>
        {items.length === 0 ? (
          <EmptyState
            hint="Pickup, carrier and delivery appear here as soon as both sides have confirmed a match."
            next="Confirm a match to start tracking"
            title="Nothing in transit"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-6">Match</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pickup and delivery</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(({ match, title }) => {
                const closed = CLOSED_STATES.includes(match.state);
                const dates = [match.pickupDate && `Pickup ${match.pickupDate}`, match.deliveryDate && `Delivery ${match.deliveryDate}`].filter(Boolean);
                const extra = [match.carrier, match.trackingRef].filter(Boolean).join(" · ");

                return (
                  <TableRow key={match.id}>
                    <TableCell className="px-6 py-4 text-base font-medium">{title}</TableCell>
                    <TableCell className="py-4">
                      <Badge className={`px-3 py-1 text-sm capitalize ${STATE_TONE[match.state] ?? ""}`} variant={STATE_TONE[match.state] ? "outline" : "secondary"}>
                        {matchStateLabel(match.state)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 text-sm">
                      {closed ? (
                        <span className="text-muted-foreground">—</span>
                      ) : dates.length ? (
                        <>
                          <p>{dates.join(" · ")}</p>
                          {extra ? <p className="text-muted-foreground">{extra}</p> : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not scheduled yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function LogisticsCard({ item }: { item: LogisticsItem }) {
  const { match, title } = item;

  return (
    <article className="rounded-lg border border-border bg-muted p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {matchStateLabel(match.state)}
        </p>
      </div>
      {match.state === "cancelled" || match.state === "expired" || match.state === "failed" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {match.state === "expired"
            ? "This proposal expired unconfirmed — no logistics planned."
            : match.state === "failed"
              ? "Delivery failed after shipping — the match is closed."
              : "This match was cancelled — no logistics planned."}
        </p>
      ) : (
        <>
          <MatchStepper className="mt-4" state={match.state} />
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p>
              <span className="font-semibold text-foreground/80">Pickup:</span> {match.pickupDate ?? "Not scheduled"}
            </p>
            <p>
              <span className="font-semibold text-foreground/80">Delivery:</span> {match.deliveryDate ?? "Not scheduled"}
            </p>
            <p>
              <span className="font-semibold text-foreground/80">Carrier:</span> {match.carrier ?? "Not assigned"}
            </p>
            <p>
              <span className="font-semibold text-foreground/80">Tracking:</span> {match.trackingRef ?? "—"}
            </p>
          </div>
        </>
      )}
    </article>
  );
}

export function LoopPanel({
  actions,
  actor,
  authConfig,
  emptyText = "Agent proposals appear here once a workflow has findings for review.",
  emptyTitle = "No active loop",
  run
}: {
  actions: AgentProposedAction[];
  actor: ActorContext;
  authConfig: SupabaseBrowserConfig | null;
  emptyText?: string;
  emptyTitle?: string;
  run: AgentRun | undefined;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Loop engineering
          </p>
          <h2 className="mt-2 text-xl font-semibold">{run?.title ?? emptyTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {run?.summary ?? emptyText}
          </p>
        </div>
        <span className="rounded-sm bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {run?.status.replace("_", " ") ?? "idle"}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {actions.length ? (
          actions.map((action) => (
            <ActionRow action={action} actor={actor} authConfig={authConfig} key={action.id} />
          ))
        ) : (
          <EmptyState
            hint="sur.plus proposes actions here — matches, document checks, logistics. Nothing is executed before you approve it."
            title="No proposals waiting"
          />
        )}
      </div>
    </section>
  );
}

function ActionRow({
  action,
  actor,
  authConfig
}: {
  action: AgentProposedAction;
  actor: ActorContext;
  authConfig: SupabaseBrowserConfig | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-border bg-muted p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{action.label}</p>
          <span className="rounded-sm bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {action.riskLevel} risk
          </span>
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{action.description}</p>
      </div>
      <AgentActionControls
        actionId={action.id}
        actorUserId={actor.userId}
        authConfig={authConfig}
        initialStatus={action.status}
      />
    </div>
  );
}

export function InvitationQueuePanel({
  actorUserId,
  authConfig,
  data,
  invitations,
  members,
  seatLimit,
  canRemoveMembers = false
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  data: RepositoryData;
  invitations: Invitation[];
  members: User[];
  seatLimit?: number;
  /** A company's own team can remove colleagues; Ops and NGOs see the list only. */
  canRemoveMembers?: boolean;
}) {
  const visibleInvitations = invitations.slice(0, 6);
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending").length;

  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-primary">
        Workspace access
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Members and invitations</h2>
        <p className="text-sm font-semibold text-muted-foreground">
          {accessSummary(members.length, pendingInvitations, seatLimit)}
        </p>
      </div>
      <div className="mt-5 grid gap-3">
        <p className="text-xs font-medium text-muted-foreground">Active members</p>
        {members.length ? (
          members.map((member) => (
            <div className="rounded-lg border border-border bg-muted p-3" key={member.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 wrap-break-word font-semibold">{member.fullName || member.email}</p>
                <span className="rounded-sm bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {member.role === "admin" || member.role === "editor"
                    ? member.role === "editor"
                      ? "sur.plus Ops (editor)"
                      : "sur.plus Ops"
                    : member.role === "corporate"
                      ? "Corporate"
                      : "NGO"}
                </span>
              </div>
              <p className="mt-1 wrap-break-word text-xs text-muted-foreground">{member.email}</p>
              {canRemoveMembers && member.id !== actorUserId && member.role === "corporate" ? (
                <MemberRemoveControls
                  actorUserId={actorUserId}
                  authConfig={authConfig}
                  memberId={member.id}
                  memberName={member.fullName || member.email}
                />
              ) : null}
            </div>
          ))
        ) : (
          <EmptyState
            hint="Colleagues you invite share this workspace and its matches."
            next="Invite someone with the form above"
            title="You are the only member"
          />
        )}
      </div>
      <div className="mt-5 grid gap-3">
        <p className="text-xs font-medium text-muted-foreground">Invitation queue</p>
        {visibleInvitations.length ? (
          visibleInvitations.map((invitation) => (
            <div className="rounded-lg border border-border bg-muted p-4" key={invitation.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 wrap-break-word font-semibold">{invitation.email}</p>
                <span className="rounded-sm bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {invitation.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-5 text-muted-foreground">
                {invitation.role === "corporate" ? "Corporate" : "NGO"} · {invitationOrgName(invitation, data)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {invitation.acceptedAt
                  ? `Accepted ${formatDate(invitation.acceptedAt)}`
                  : invitation.expiresAt
                    ? `Expires ${formatDate(invitation.expiresAt)}`
                    : "No expiry set"}
              </p>
              <InvitationDeliveryLine attempt={latestInvitationDelivery(invitation.id, data)} />
              <InvitationRevokeControls
                actorUserId={actorUserId}
                authConfig={authConfig}
                initialStatus={invitation.status}
                invitationId={invitation.id}
              />
            </div>
          ))
        ) : (
          <EmptyState
            hint="Sent invitations stay here until they are accepted, expire, or you revoke them."
            title="No invitations sent"
          />
        )}
      </div>
    </section>
  );
}

function accessSummary(activeMembers: number, pendingInvitations: number, seatLimit?: number): string {
  const usedSeats = activeMembers + pendingInvitations;
  if (seatLimit) return `${usedSeats}/${seatLimit} seats used · ${pendingInvitations} pending`;

  return `${activeMembers} active · ${pendingInvitations} pending`;
}

function InvitationDeliveryLine({ attempt }: { attempt: InvitationDeliveryAttempt | undefined }) {
  if (!attempt) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Delivery not recorded yet.
      </p>
    );
  }

  const detail =
    attempt.status === "sent"
      ? attempt.messageId
        ? `message ${attempt.messageId}`
        : "message accepted"
      : attempt.error ?? attempt.reason ?? "no provider detail";

  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Delivery {attempt.operation}: <span className="font-semibold">{attempt.status}</span> via {attempt.provider} · {detail}
    </p>
  );
}

function latestInvitationDelivery(invitationId: string, data: RepositoryData): InvitationDeliveryAttempt | undefined {
  return data.invitationDeliveryAttempts
    .filter((attempt) => attempt.invitationId === invitationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function invitationOrgName(invitation: Invitation, data: RepositoryData): string {
  if (invitation.orgName) return invitation.orgName;
  if (invitation.companyId) {
    return data.companies.find((company) => company.id === invitation.companyId)?.name ?? "Corporate";
  }
  if (invitation.ngoId) {
    return data.ngos.find((ngo) => ngo.id === invitation.ngoId)?.name ?? "NGO";
  }

  return "sur.plus Ops";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

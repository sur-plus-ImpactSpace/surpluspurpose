import {
  type ActorContext,
  type AgentProposedAction,
  type Company,
  type Document,
  type Ngo,
  type NgoOrgType,
  ngoRequiresProofExpiry,
  type RepositoryData,
  type SurplusRepository
} from "@surplus/domain";
import { InvitationCreatePanel, type InvitationOrgOption } from "../InvitationCreatePanel";
import { MatchConfirmControls } from "../MatchConfirmControls";
import { CompanyVerificationControls } from "../CompanyVerificationControls";
import { CompanyVerificationDocuments } from "../CompanyVerificationDocuments";
import { NgoVerificationControls } from "../NgoVerificationControls";
import { NgoVerificationDocuments } from "../NgoVerificationDocuments";
import { nextMatchActionForRole } from "../match-actions";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import {
  EmptyState,
  InvitationQueuePanel,
  LogisticsCard,
  LoopPanel,
  NextStepHero,
  ProfileRow,
  type LogisticsItem
} from "./shared";
import { OverviewBento } from "./OverviewBento";

export function AdminDashboard({
  actor,
  authConfig,
  data,
  repo
}: {
  actor: Extract<ActorContext, { role: "admin" | "editor" }>;
  authConfig: SupabaseBrowserConfig | null;
  data: RepositoryData;
  repo: SurplusRepository;
}) {
  const matches = repo.matches.list(actor);
  const documents = repo.documents.list(actor);
  const auditEvents = repo.auditEvents.list();
  const invitations = repo.invitations.list(actor);
  const members = repo.users.list(actor);
  const pendingActions = data.proposedActions.filter((action) => action.status === "pending");
  const pendingInvitations = invitations.filter((invitation) => invitation.status === "pending");
  const verificationQueue = data.ngos.filter((ngo) => ngo.verificationState !== "verified");
  const companyVerificationQueue = data.companies.filter(
    (company) => (company.verificationState ?? "onboarding") !== "verified"
  );
  const logisticsPending = matches.filter((match) => nextMatchActionForRole(match.state, "admin") !== null).length;
  const nextStep = opsNextStep({
    approvals: pendingActions.length,
    logistics: logisticsPending,
    verifications: verificationQueue.length
  });
  const inviteOrgOptions: InvitationOrgOption[] = [
    ...data.companies.map((company) => ({ id: company.id, label: company.name, role: "corporate" as const })),
    ...data.ngos.map((ngo) => ({ id: ngo.id, label: ngo.name, role: "ngo" as const }))
  ];

  return (
    <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-5 px-5 py-6 sm:px-8">
      <NextStepHero body={nextStep.body} title={nextStep.title} tone={nextStep.tone} />

      <OverviewBento
        matches={matches}
        repo={repo}
        stats={[
          { label: "Companies", value: String(data.companies.length) },
          { label: "NGO queue", value: String(verificationQueue.length) },
          { label: "Users", value: String(members.length) },
          { label: "Invites", value: String(pendingInvitations.length) },
          { label: "Action queue", value: String(pendingActions.length) }
        ]}
      />

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[1fr_1fr]" id="a-verification">
        <AdminVerificationPanel actorUserId={actor.userId} authConfig={authConfig} ngos={verificationQueue} />
        <AdminServicePanel
          actorUserId={actor.userId}
          authConfig={authConfig}
          items={matches.map((match) => ({
            match,
            title: repo.listings.get(match.listingId)?.title ?? match.id
          }))}
        />
      </section>

      <AdminCompanyVerificationPanel companies={companyVerificationQueue} />

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[1.05fr_0.95fr]" id="a-controls">
        <LoopPanel
          actions={pendingActions}
          actor={actor}
          authConfig={authConfig}
          emptyText="Pending proposals across Corporate and NGO workspaces wait here before execution."
          emptyTitle="Ops approval loop"
          run={undefined}
        />
        <AdminRiskPanel actions={pendingActions} documents={documents} />
      </section>

      <section className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] lg:scroll-mt-20 gap-5 lg:grid-cols-[0.95fr_1.05fr]" id="a-members">
        <InvitationCreatePanel
          actorUserId={actor.userId}
          authConfig={authConfig}
          defaultOrgId={inviteOrgOptions[0]?.id ?? ""}
          defaultRole={inviteOrgOptions[0]?.role ?? "corporate"}
          mode="admin"
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

      <section>
        <AuditPanel events={auditEvents} />
      </section>
    </section>
  );
}

export function AdminVerificationPanel({
  actorUserId,
  authConfig,
  ngos
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  ngos: Ngo[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-xs">
      <h2 className="text-lg font-semibold">
        Verification queue <span className="text-sm font-normal text-muted-foreground">({ngos.length})</span>
      </h2>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {ngos.length ? (
          ngos.map((ngo) => (
            <div className="grid content-start gap-4 rounded-xl border border-border bg-muted p-5" key={ngo.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="wrap-break-word text-base font-semibold text-foreground">{ngo.name}</p>
                  <p className="mt-1 wrap-break-word text-sm text-muted-foreground">
                    {metaLine([ngo.city, ngo.country].filter(Boolean).join(", "), ngo.focus, `Trust ${ngo.trustScore}/100`)}
                  </p>
                </div>
                <span className="inline-flex w-fit items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                  {ngo.verificationState.replace(/_/g, " ")}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <ApplicationField label="Org type" value={orgTypeLabel(ngo.orgType)} />
                <ApplicationField label="Registry no." value={ngo.registryNumber} />
                <ApplicationField label="Authorized signer" value={signerLabel(ngo)} />
                <ApplicationField label="Contact" value={ngo.contactEmail} />
              </dl>
              <NgoVerificationDocuments ngoId={ngo.id} />
              <NgoVerificationControls
                actorUserId={actorUserId}
                authConfig={authConfig}
                initialAssessmentPeriodYears={ngo.proofAssessmentPeriodYears ?? 5}
                initialNoticeDate={ngo.proofNoticeDate ?? ngo.taxAuthorizationDate ?? ""}
                ngoId={ngo.id}
                requiresProofExpiry={ngoRequiresProofExpiry(ngo.orgType)}
              />
            </div>
          ))
        ) : (
          <EmptyState title="Verification queue is clear" />
        )}
      </div>
    </section>
  );
}

function AdminCompanyVerificationPanel({ companies }: { companies: Company[] }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-muted-foreground">
        Company verification
      </p>
      <h2 className="mt-2 text-xl font-semibold">Corporate business proof</h2>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {companies.length ? (
          companies.map((company) => (
            <div className="rounded-lg border border-border bg-muted p-3.5" key={company.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 wrap-break-word font-semibold">{company.name}</p>
                <span className="inline-flex w-fit items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                  {(company.verificationState ?? "onboarding").replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1 wrap-break-word text-sm text-muted-foreground">
                {metaLine([company.city, company.country].filter(Boolean).join(", "), company.contactEmail)}
              </p>
              <CompanyVerificationDocuments companyId={company.id} />
              <CompanyVerificationControls companyId={company.id} />
            </div>
          ))
        ) : (
          <EmptyState
            hint="Every corporate is reviewed against a business proof. New applications land here."
            title="Company verification is clear"
          />
        )}
      </div>
    </section>
  );
}

/** Joins the parts that exist with a middle dot, so empty fields leave no stray separators. */
function metaLine(...parts: Array<string | null | undefined>): string {
  return parts.filter((part) => part && part.trim()).join(" · ");
}

function ApplicationField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-foreground/80" title={value?.trim() || undefined}>{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

export function signerLabel(ngo: Ngo): string {
  if (!ngo.authorizedSigner) return "";
  return ngo.authorizedSignerRole ? `${ngo.authorizedSigner} (${ngo.authorizedSignerRole})` : ngo.authorizedSigner;
}

const ORG_TYPE_LABEL: Record<NgoOrgType, string> = {
  verein: "Verein (e.V.)",
  ggmbh: "gGmbH / gUG",
  stiftung: "Stiftung",
  public_body: "Public body",
  freier_traeger: "Independent sponsor"
};

export function orgTypeLabel(orgType: NgoOrgType | null | undefined): string | null {
  return orgType ? ORG_TYPE_LABEL[orgType] : null;
}

function AdminServicePanel({
  actorUserId,
  authConfig,
  items
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  items: LogisticsItem[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-primary">
        Service operations
      </p>
      <h2 className="mt-2 text-xl font-semibold">Logistics per match</h2>
      {items.length === 0 ? (
        <EmptyState
          className="mt-5"
          hint="Once a Corporate and an NGO both confirm, the match and its logistics appear here."
          title="No matches to coordinate"
        />
      ) : (
        <div className="mt-5 grid gap-4">
          {items.map(({ match, title }) => {
            const action = nextMatchActionForRole(match.state, "admin");

            return (
              <div className="grid gap-2" key={match.id}>
                <LogisticsCard item={{ match, title }} />
                {action ? (
                  <MatchConfirmControls
                    action={action}
                    actorUserId={actorUserId}
                    authConfig={authConfig}
                    matchId={match.id}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AdminRiskPanel({
  actions,
  documents
}: {
  actions: AgentProposedAction[];
  documents: Document[];
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-muted-foreground">
        Risk queue
      </p>
      <h2 className="mt-2 text-xl font-semibold">Human review before execution</h2>
      <div className="mt-5 grid gap-3">
        <ProfileRow label="Pending actions" value={String(actions.length)} detail="Copilot proposals wait for approval." />
        <ProfileRow label="Documents" value={String(documents.length)} detail="Certificates, reports and uploads stay scoped." />
        <ProfileRow label="Admin login" value="Hidden by role" detail="Ops appears only after authenticated admin claim." />
      </div>
    </section>
  );
}

function AuditPanel({ events }: { events: ReturnType<SurplusRepository["auditEvents"]["list"]> }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-primary">
        Audit trail
      </p>
      <h2 className="mt-2 text-xl font-semibold">Recent controls</h2>
      <div className="mt-5 grid gap-3">
        {events.slice(0, 4).map((event) => (
          <div className="rounded-lg border border-border bg-muted p-3" key={event.id}>
            <p className="font-semibold">{event.action}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.actor} · {event.visibility.replace("_", " ")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Turns the Ops queues into the single most important next step. */
function opsNextStep({
  approvals,
  logistics,
  verifications
}: {
  approvals: number;
  logistics: number;
  verifications: number;
}): { body: string; title: string; tone: "act" | "wait" | "done" } {
  if (logistics > 0) {
    return {
      tone: "act",
      title: `${logistics} ${logistics === 1 ? "match needs" : "matches need"} a logistics move`,
      body: "Advance pickup or delivery in Service operations below — the parties are waiting on Ops to move the match forward."
    };
  }
  if (verifications > 0) {
    return {
      tone: "act",
      title: `${verifications} ${verifications === 1 ? "NGO is" : "NGOs are"} awaiting verification`,
      body: "Review the verification queue before these NGOs can be matched — trust is the gate on the whole loop."
    };
  }
  if (approvals > 0) {
    return {
      tone: "act",
      title: `${approvals} ${approvals === 1 ? "proposal" : "proposals"} waiting for approval`,
      body: "Copilot proposals sit in the approval loop below. Nothing executes until you approve it."
    };
  }

  return {
    tone: "done",
    title: "The queue is clear",
    body: "No logistics moves, verifications or proposals need Ops right now. New work lands here as it comes in."
  };
}

import {
  type AccessRequest,
  type EnvelopeState,
  type SignatureEnvelope,
  type Co2Factor,
  CO2_FACTOR_MAX,
  type CompanyCheck,
  type Notification,
  PROPOSAL_EXPIRY_WARNING_DAYS,
  matchStatusMessage,
  planAllows,
  type AgentProposedAction,
  type AgentRun,
  type AuditEvent,
  type Company,
  type Document,
  type FullNgoProfile,
  type Invitation,
  type InvitationDeliveryAttempt,
  type InvitationDeliveryOperation,
  type InvitationDeliveryStatus,
  type DonationAllocation,
  type DonationCase,
  type DonationCaseStep,
  type DonationPosition,
  activeAllocatedQuantity,
  assertDonationCaseAllocatable,
  type Listing,
  type Match,
  type MatchState,
  type Message,
  type Need,
  NEED_DELIVERY_PREFERENCES,
  type NeedDeliveryPreference,
  type NeedUrgency,
  type Ngo,
  PLAN_ENTITLEMENTS,
  PROPOSAL_EXPIRY_DAYS,
  type PlanTier,
  type PublicNgoProfile,
  type SchedulerJobRun,
  type User,
  type Visibility,
  holdsQuota,
  MATCH_CANCELLABLE_STATES,
  MATCH_FAILABLE_STATES,
  deriveProofValidUntil,
  isCompanyVerified,
  isNgoProofExpiringSoon,
  isNgoVerified,
  isTerminalMatchState,
  needOpenQuantity,
  ngoRequiresProofExpiry,
  unlocksContact
} from "./model";
import {
  createDeterministicAgentPlan,
  normalizeAgentRunInput,
  type AgentPlanDocument,
  type AgentPlanProposedAction,
  type AgentRunInput
} from "./agent-planner";
import type { AccessRequestInput } from "./access-request-api";
import { decideCompanyCheck, type CompanyCheckResult } from "./company-check";
import {
  NGO_VERIFICATION_ACTION_TARGET,
  type NgoVerificationAction
} from "./ngo-verification-api";
import { isOpsAdminRole, isOpsRole } from "./ops-roles";

export type NgoVerificationInput = {
  action: NgoVerificationAction;
  proofNoticeDate?: string | null;
  proofAssessmentPeriodYears?: number | null;
};

export type ActorContext =
  | { role: "admin"; userId: string }
  | { role: "editor"; userId: string }
  | { role: "corporate"; userId: string; companyId: string }
  | { role: "ngo"; userId: string; ngoId: string };

export type RepositoryData = {
  /** Public "Request access" leads. Ops reads them; RLS hides them from everyone else. */
  accessRequests: AccessRequest[];
  notifications: Notification[];
  companyChecks: CompanyCheck[];
  co2Factors: Co2Factor[];
  signatureEnvelopes: SignatureEnvelope[];
  companies: Company[];
  ngos: Ngo[];
  users: User[];
  invitations: Invitation[];
  invitationDeliveryAttempts: InvitationDeliveryAttempt[];
  listings: Listing[];
  /** Parallel CASE model (REQ-CORP-01 / ADR 0033); listings remain the match path. */
  donationCases: DonationCase[];
  donationPositions: DonationPosition[];
  /** Position → NGO allocations (REQ-MATCH-09 / ADR 0037). */
  donationAllocations: DonationAllocation[];
  needs: Need[];
  matches: Match[];
  messages: Message[];
  documents: Document[];
  auditEvents: AuditEvent[];
  agentRuns: AgentRun[];
  proposedActions: AgentProposedAction[];
  /** Timed job invocations (REQ-OPS-13). Failed + unacked rows feed the Ops risk queue. */
  schedulerJobRuns: SchedulerJobRun[];
};

export type TransitionResult =
  | { ok: true; match: Match }
  | { ok: false; reason: string };

export type SignatureEnvelopeInput = {
  documentId: string;
  externalId: string;
  companyName: string;
  companyEmail: string;
  ngoName: string;
  ngoEmail: string;
};

export type SignatureEnvelopeResult = { ok: true; envelope: SignatureEnvelope } | { ok: false; reason: string };

/** What the verified DocuSeal webhook reports. Mirrors apply_docuseal_event (0055). */
export type DocusealEvent = {
  externalId: string;
  event: "viewed" | "signed" | "declined" | "completed" | "voided";
  email?: string | null;
  signedStoragePath?: string | null;
};

export type Co2FactorResult = { ok: true; factor: Co2Factor } | { ok: false; reason: string };

export type MemberRemovalResult = { ok: true } | { ok: false; reason: string };

export type MatchProposalInput = {
  listingId: string;
  needId: string;
  /** The part of the need to cover. Defaults to what the listing gives and the need still wants. */
  quantity?: number;
};

export type MatchFailureInput = {
  ngoAtFault: boolean;
  reason?: string;
};

export type NgoVerificationResult =
  | { ok: true; ngo: Ngo }
  | { ok: false; reason: string };

export type ProposedActionResult =
  | { ok: true; action: AgentProposedAction }
  | { ok: false; reason: string };

export type AgentRunCreateResult =
  | { ok: true; run: AgentRun; actions: AgentProposedAction[]; document: Document | null }
  | { ok: false; reason: string };

export type MessageCreateResult =
  | { ok: true; message: Message }
  | { ok: false; reason: string };

export type ListingEligibilityInput = {
  usable: boolean;
  policyFit: boolean;
  ownership: boolean;
};

export type ListingCreateInput = {
  title: string;
  category: string;
  subcategory?: string | null;
  quantity: number;
  unit?: string;
  unitValue: number;
  city: string;
  country: string;
  condition: string;
  availableUntil?: string | null;
  pickupWindow?: string;
  packaging?: string;
  weightKg?: number;
  categoryDetails?: string;
  eligibility: ListingEligibilityInput;
  /** Admin only: which company the listing belongs to. Ignored for corporate actors. */
  companyId?: string;
};

export type ListingCreateResult =
  | { ok: true; listing: Listing }
  | { ok: false; reason: string };

export type DonationCaseCreateInput = {
  title: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  city: string;
  country: string;
  locationNotes?: string | null;
  timeWindow?: string | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  /** Admin only: which company the case belongs to. Ignored for corporate actors. */
  companyId?: string;
};

export type DonationCaseCreateResult =
  | { ok: true; donationCase: DonationCase }
  | { ok: false; reason: string };

export type DonationPositionCreateInput = {
  category: string;
  model: string;
  quantity: number;
  condition: string;
  provenance: string;
};

export type DonationPositionCreateResult =
  | { ok: true; position: DonationPosition; donationCase: DonationCase }
  | { ok: false; reason: string };

export type DonationPositionImportResult =
  | { ok: true; positions: DonationPosition[]; donationCase: DonationCase }
  | { ok: false; reason: string };

export type DonationCaseConfirmResult =
  | { ok: true; donationCase: DonationCase; reopened?: false }
  | { ok: false; reason: string };

export type DonationAllocationCreateInput = {
  positionId: string;
  ngoId: string;
  quantity: number;
};

export type DonationAllocationCreateResult =
  | { ok: true; allocation: DonationAllocation; position: DonationPosition }
  | { ok: false; reason: string };

export type DonationAllocationReleaseInput = {
  releaseNote: string;
};

export type DonationAllocationReleaseResult =
  /** `position` is null when the actor cannot read it (NGO under RLS). */
  | { ok: true; allocation: DonationAllocation; position: DonationPosition | null }
  | { ok: false; reason: string };

export type NeedCreateInput = {
  title: string;
  category: string;
  /** Catalog subcategory id. Required in the form; optional here so admin/API
   *  callers and legacy paths stay lenient (analogous to Listing.subcategory). */
  subcategory?: string | null;
  /** Optional: five of eight real submissions had no clean number. */
  quantity?: number;
  quantityOpen?: boolean;
  urgency?: NeedUrgency;
  city: string;
  country: string;
  targetDate?: string | null;
  beneficiaries?: number;
  /** Required, min STORY_MIN_WORDS words — see need-api. */
  story: string;
  /** Defaults to `either` when omitted (ADR 0035). */
  deliveryPreference?: NeedDeliveryPreference;
  /** Optional per-match cap; null/omitted = no cap beyond open remainder. */
  maxQuantityPerMatch?: number | null;
  /** Who benefits — required at the API boundary (REQ-NGO-05). */
  targetGroup: string;
  /** Delivery street/building; may differ from NGO.address. */
  deliveryAddress: string;
  hasVehicle?: boolean;
  /** Admin only: which NGO the need belongs to. Ignored for NGO actors. */
  ngoId?: string;
};

export type CompanyPlanResult =
  | { ok: true; company: Company }
  | {
      ok: false;
      reason: "actor_not_allowed" | "company_not_found" | "seat_limit_exceeded";
    };

export type NeedCreateResult =
  | { ok: true; need: Need }
  | { ok: false; reason: string };

export type InvitationCreateInput = {
  email: string;
  role: "corporate" | "ngo";
  acceptanceTokenHash?: string;
  companyId?: string;
  ngoId?: string;
  orgName?: string;
  expiresAt?: string | null;
};

export type InvitationCreateResult =
  | { ok: true; invitation: Invitation }
  | { ok: false; reason: string };

export type InvitationMutationResult =
  | { ok: true; invitation: Invitation }
  | { ok: false; reason: string };

export type InvitationDeliveryAttemptInput = {
  invitationId: string;
  operation: InvitationDeliveryOperation;
  provider: string;
  status: InvitationDeliveryStatus;
  messageId?: string | null;
  error?: string | null;
  reason?: string | null;
};

export type InvitationDeliveryAttemptResult =
  | { ok: true; attempt: InvitationDeliveryAttempt }
  | { ok: false; reason: string };

export type SurplusRepository = {
  users: {
    list(actor: ActorContext): User[];
    /**
     * A company member removes a colleague of the same company, which frees the
     * seat. Nobody removes themselves. Mirrors remove_company_member (0050).
     */
    removeFromCompany(actor: ActorContext, userId: string): MemberRemovalResult;
  };
  companies: {
    get(id: string): Company | undefined;
    list(): Company[];
    countCommittedMatches(companyId: string, year: number): number;
    /**
     * System, after the server ran the network checks: store the result and
     * decide. All passed -> verified; otherwise Ops reviews. A rejected company
     * is never auto-approved. Mirrors record_company_check (0044).
     */
    recordCheck(
      companyId: string,
      input: CompanyCheckResult & { vatId: string; website: string }
    ): CompanyCheck | undefined;
    /** Ops-only: move a company between plans. The manual stand-in for billing. */
    setPlan(id: string, plan: PlanTier, actor: ActorContext): CompanyPlanResult;
  };
  ngos: {
    getPublic(id: string): PublicNgoProfile | undefined;
    getForMatch(matchId: string, actor: ActorContext): PublicNgoProfile | FullNgoProfile | undefined;
    /** Ops-only: list every NGO for the verification queue. */
    listForAdmin(actor: ActorContext): Ngo[];
    /** Ops-only: move an NGO application to a new verification state. */
    setVerification(
      id: string,
      input: NgoVerificationAction | NgoVerificationInput,
      actor: ActorContext
    ): NgoVerificationResult;
    /** REQ-NGO-06 · 60-day reminder to NGO + Ops before proof expiry. */
    warnExpiringProofs(now: string): Ngo[];
    /** REQ-NGO-06 · suspend verification when derived proof validity lapses. */
    expireProofs(now: string): Ngo[];
  };
  listings: {
    get(id: string): Listing | undefined;
    listForCompany(companyId: string): Listing[];
    create(actor: ActorContext, input: ListingCreateInput): ListingCreateResult;
  };
  donationCases: {
    get(id: string): DonationCase | undefined;
    listForCompany(companyId: string): DonationCase[];
    create(actor: ActorContext, input: DonationCaseCreateInput): DonationCaseCreateResult;
    addPosition(
      actor: ActorContext,
      caseId: string,
      input: DonationPositionCreateInput
    ): DonationPositionCreateResult;
    importPositions(
      actor: ActorContext,
      caseId: string,
      inputs: DonationPositionCreateInput[]
    ): DonationPositionImportResult;
    /** REQ-CORP-02: company confirms inventory → step 4, positions confirmed. */
    confirm(actor: ActorContext, caseId: string): DonationCaseConfirmResult;
  };
  donationPositions: {
    get(id: string): DonationPosition | undefined;
    listForCase(caseId: string): DonationPosition[];
  };
  donationAllocations: {
    get(id: string): DonationAllocation | undefined;
    listForCase(caseId: string): DonationAllocation[];
    listForNgo(ngoId: string): DonationAllocation[];
    /** REQ-MATCH-09: Ops binds position + NGO + qty while case is confirmed. */
    create(
      actor: ActorContext,
      caseId: string,
      input: DonationAllocationCreateInput
    ): DonationAllocationCreateResult;
    /** REQ-MATCH-09: NGO written release; quantity returns to the pool. */
    release(
      actor: ActorContext,
      allocationId: string,
      input: DonationAllocationReleaseInput
    ): DonationAllocationReleaseResult;
  };
  needs: {
    get(id: string): Need | undefined;
    listForNgo(ngoId: string): Need[];
    create(actor: ActorContext, input: NeedCreateInput): NeedCreateResult;
  };
  matches: {
    get(id: string): Match | undefined;
    list(actor: ActorContext): Match[];
    /** Ops-only: pair an open listing with an open need as a `proposed` match. */
    propose(actor: ActorContext, input: MatchProposalInput): TransitionResult;
    /**
     * Ops-only: the goods shipped and delivery broke down. Unless the NGO is at
     * fault the company gets its quota unit back (ADR 0028 D4).
     */
    fail(actor: ActorContext, id: string, input: MatchFailureInput): TransitionResult;
    /**
     * System job (no actor): remind both sides of proposals that expire within
     * PROPOSAL_EXPIRY_WARNING_DAYS. Once per proposal. Returns the matches warned.
     */
    warnExpiring(now: string): Match[];
    /**
     * System job (no actor): expire `proposed` matches older than
     * PROPOSAL_EXPIRY_DAYS and release their listings. Returns what expired.
     * Production runs the same rule in the database (expire_stale_proposals).
     */
    expireStale(now: string): Match[];
    transition(id: string, nextState: MatchState, actor: ActorContext): TransitionResult;
  };
  messages: {
    listForMatch(matchId: string, actor: ActorContext): Message[];
    create(matchId: string, body: string, actor: ActorContext): MessageCreateResult;
  };
  signatureEnvelopes: {
    /** Envelopes the actor may see: Ops all; the parties of the document's match once verified. */
    list(actor: ActorContext): SignatureEnvelope[];
    /** Ops-only: record the envelope DocuSeal just created, with both signers. Mirrors create_signature_envelope (0055). */
    create(actor: ActorContext, input: SignatureEnvelopeInput): SignatureEnvelopeResult;
    /** System, from the verified DocuSeal webhook only (invariant 5). Returns the envelope's state. */
    applyDocusealEvent(input: DocusealEvent): EnvelopeState | undefined;
  };
  co2Factors: {
    list(): Co2Factor[];
    /** Ops-only: set the kg CO2e avoided per kg of goods for a category. Audited with old and new value. Mirrors set_co2_factor (0054). */
    set(actor: ActorContext, input: { category: string; kgCo2ePerKg: number }): Co2FactorResult;
  };
  notifications: {
    /** The actor's own notifications, newest first. */
    list(actor: ActorContext): Notification[];
  };
  accessRequests: {
    /** Public form: no actor. One entry per email; a repeat refreshes the details. */
    submit(input: AccessRequestInput): void;
    /** Ops only; everyone else gets an empty list. */
    list(actor: ActorContext): AccessRequest[];
  };
  invitations: {
    list(actor: ActorContext): Invitation[];
    create(actor: ActorContext, input: InvitationCreateInput): InvitationCreateResult;
    resend(actor: ActorContext, invitationId: string): InvitationMutationResult;
    revoke(actor: ActorContext, invitationId: string): InvitationMutationResult;
  };
  invitationDeliveries: {
    list(actor: ActorContext): InvitationDeliveryAttempt[];
    listForInvitation(actor: ActorContext, invitationId: string): InvitationDeliveryAttempt[];
    record(actor: ActorContext, input: InvitationDeliveryAttemptInput): InvitationDeliveryAttemptResult;
  };
  documents: {
    get(id: string, actor: ActorContext): Document | undefined;
    list(actor: ActorContext): Document[];
  };
  auditEvents: {
    list(): AuditEvent[];
  };
  agentRuns: {
    create(actor: ActorContext, input: AgentRunInput): AgentRunCreateResult;
    get(id: string, actor: ActorContext): AgentRun | undefined;
    list(actor: ActorContext): AgentRun[];
  };
  proposedActions: {
    listForRun(runId: string, actor: ActorContext): AgentProposedAction[];
    approve(id: string, actor: ActorContext): ProposedActionResult;
    reject(id: string, actor: ActorContext): ProposedActionResult;
    execute(id: string, actor: ActorContext): ProposedActionResult;
  };
  assertReferentialIntegrity(): string[];
  snapshot(): RepositoryData;
};

type TransitionRule = {
  from: MatchState;
  to: MatchState;
  canAct: (actor: ActorContext, match: Match, data: RepositoryData) => boolean;
  /** The acting organisation must be verified (ADR 0027); checked after canAct. */
  actorVerified?: (match: Match, data: RepositoryData) => boolean;
  apply?: (match: Match, data: RepositoryData) => void;
};

const TRANSITION_RULES: readonly TransitionRule[] = [
  {
    from: "proposed",
    to: "ngo_confirmed",
    canAct: (actor, match, data) => actor.role === "ngo" && needForMatch(match, data)?.ngoId === actor.ngoId,
    actorVerified: (match, data) => isNgoVerified(ngoForMatch(match, data))
  },
  {
    from: "ngo_confirmed",
    to: "both_confirmed",
    canAct: (actor, match, data) =>
      actor.role === "corporate" && listingForMatch(match, data)?.companyId === actor.companyId,
    actorVerified: (match, data) => isCompanyVerified(companyForMatch(match, data)),
    apply: (match, data) => {
      match.committedAt = match.committedAt ?? nowIso();
      const listing = listingForMatch(match, data);
      if (listing) listing.state = "confirmed";
    }
  },
  {
    from: "both_confirmed",
    to: "in_transit",
    canAct: (actor) => isOpsRole(actor.role)
  },
  {
    from: "in_transit",
    to: "delivered",
    canAct: (actor) => isOpsRole(actor.role)
  },
  {
    from: "delivered",
    to: "completed",
    canAct: (actor, match, data) => actor.role === "ngo" && needForMatch(match, data)?.ngoId === actor.ngoId,
    apply: (match, data) => {
      const listing = listingForMatch(match, data);
      if (listing) listing.state = "completed";
      ensureCompletionDocuments(match, data);
    }
  }
];

/**
 * M2/C3: completing a match guarantees an approved donation certificate and
 * CSRD note. Existing drafts are promoted instead of duplicated; the download
 * route renders their content on the fly from match data.
 */
function ensureCompletionDocuments(match: Match, data: RepositoryData): void {
  const listing = listingForMatch(match, data);
  const now = nowIso();
  const specs: Array<{ kind: Document["kind"]; title: string }> = [
    { kind: "certificate", title: `Donation certificate · ${listing?.title ?? match.id}` },
    { kind: "report", title: `CSRD evidence note · ${listing?.title ?? match.id}` }
  ];

  for (const spec of specs) {
    const existing = data.documents.find(
      (document) => document.matchId === match.id && document.kind === spec.kind
    );
    if (existing) {
      if (existing.status !== "approved" && existing.status !== "published") {
        existing.status = "approved";
      }
      existing.publishedAt = existing.publishedAt ?? now;
      continue;
    }

    data.documents.push({
      id: `doc-${data.documents.length + 1}`,
      kind: spec.kind,
      title: spec.title,
      status: "approved",
      companyId: listing?.companyId ?? null,
      ngoId: null,
      matchId: match.id,
      storagePath: null,
      mime: null,
      sizeBytes: null,
      createdBy: null,
      createdAt: now,
      publishedAt: now
    });
  }
}

export function createInMemoryRepository(initialData: RepositoryData = createSeedData()): SurplusRepository {
  const data = cloneData(initialData);

  return {
    users: {
      list: (actor) => data.users.filter((user) => canSeeUser(user, actor)),
      removeFromCompany: (actor, userId) => {
        if (actor.role !== "corporate") return { ok: false, reason: "actor_not_allowed" };
        if (userId === actor.userId) return { ok: false, reason: "cannot_remove_self" };
        const member = data.users.find((user) => user.id === userId);
        if (!member || member.companyId !== actor.companyId) return { ok: false, reason: "member_not_found" };

        data.users = data.users.filter((user) => user.id !== userId);
        recordAudit(data, actor.userId, "member.removed", userId, "customer_visible");
        return { ok: true };
      }
    },
    companies: {
      get: (id) => data.companies.find((company) => company.id === id),
      list: () => [...data.companies],
      countCommittedMatches: (companyId, year) => countCommittedMatches(data, companyId, year),
      recordCheck: (companyId, input) => {
        const company = data.companies.find((item) => item.id === companyId);
        if (!company) return undefined;

        const outcome = decideCompanyCheck(input);
        const check: CompanyCheck = {
          id: `chk-${data.companyChecks.length + 1}`,
          companyId,
          vatOk: input.vatOk,
          vatName: input.vatName,
          domainOk: input.domainOk,
          websiteOk: input.websiteOk,
          outcome,
          createdAt: nowIso()
        };
        data.companyChecks.unshift(check);
        company.vatId = input.vatId;
        company.website = input.website;
        if (company.verificationState !== "rejected" && company.verificationState !== "verified") {
          company.verificationState = outcome === "approved" ? "verified" : "review";
          if (outcome === "approved") company.verifiedAt = nowIso().slice(0, 10);
        }
        recordAudit(
          data,
          "system",
          outcome === "approved" && company.verificationState === "verified" ? "company.auto_verified" : "company.check_needs_review",
          companyId,
          "admin_only"
        );
        return check;
      },
      setPlan: (id, plan, actor) => {
        if (!isOpsAdminRole(actor.role)) return { ok: false, reason: "actor_not_allowed" };
        const company = data.companies.find((item) => item.id === id);
        if (!company) return { ok: false, reason: "company_not_found" };

        // A downgrade must not strand users over the new seat limit. Refuse
        // rather than silently leave the company in breach of its own plan —
        // mirrors the guard in set_company_plan (0020).
        const seats = data.users.filter(
          (user) => user.role === "corporate" && user.companyId === id
        ).length;
        if (seats > PLAN_ENTITLEMENTS[plan].userSeats) {
          return { ok: false, reason: "seat_limit_exceeded" };
        }

        company.plan = plan;
        recordAudit(data, actor.userId, `company.plan_set:${plan}`, id, "admin_only");
        return { ok: true, company };
      }
    },
    ngos: {
      getPublic: (id) => {
        const ngo = data.ngos.find((item) => item.id === id);
        return ngo ? publicNgoProfile(ngo) : undefined;
      },
      getForMatch: (matchId, actor) => {
        const match = data.matches.find((item) => item.id === matchId);
        if (!match) return undefined;
        if (!canSeeMatch(match, actor, data)) return undefined;

        const need = needForMatch(match, data);
        const ngo = need ? data.ngos.find((item) => item.id === need.ngoId) : undefined;
        if (!ngo) return undefined;

        if (isOpsRole(actor.role)) return fullNgoProfile(ngo);
        if (actor.role === "ngo" && actor.ngoId === ngo.id) return fullNgoProfile(ngo);
        if (
          actor.role === "corporate" &&
          unlocksContact(match.state) &&
          isCompanyVerified(data.companies.find((item) => item.id === actor.companyId))
        ) {
          return fullNgoProfile(ngo);
        }
        return publicNgoProfile(ngo);
      },
      listForAdmin: (actor) => {
        if (!isOpsRole(actor.role)) return [];
        return data.ngos;
      },
      setVerification: (id, input, actor) => {
        if (!isOpsRole(actor.role)) return { ok: false, reason: "actor_not_allowed" };
        const ngo = data.ngos.find((item) => item.id === id);
        if (!ngo) return { ok: false, reason: "ngo_not_found" };

        const parsed = normalizeVerificationInput(input);
        const action = parsed.action;
        const target = NGO_VERIFICATION_ACTION_TARGET[action];

        if (action === "approve") {
          const applied = applyProofValidityOnApprove(ngo, parsed);
          if (!applied.ok) return applied;
        } else if (target !== "verified") {
          // Leaving verified clears the live validity stamp; renew on next approve.
          ngo.proofExpiryRemindedAt = null;
        }

        ngo.verificationState = target;
        ngo.verifiedAt = target === "verified" ? nowIso() : null;
        if (action === "approve") {
          let promoted = 0;
          for (const need of data.needs) {
            if (need.ngoId === id && need.state === "draft") {
              need.state = "open";
              promoted += 1;
            }
          }
          if (promoted > 0) {
            recordAudit(data, actor.userId, `need.drafts_promoted:${promoted}`, id, "admin_only");
          }
        }
        recordAudit(data, actor.userId, `ngo.${action}`, id, "admin_only");
        return { ok: true, ngo };
      },
      warnExpiringProofs: (now) => {
        const due = data.ngos.filter(
          (ngo) => isNgoProofExpiringSoon(ngo, now) && !ngo.proofExpiryRemindedAt
        );
        for (const ngo of due) {
          notifyNgoProofParties(data, ngo, {
            kind: "ngo_proof_expiring",
            title: "Charitable-status proof is expiring",
            body: `Your verification proof is valid until ${ngo.proofValidUntil}. Upload a renewed notice so Ops can re-approve before new matches are blocked.`,
            dedupeKey: `ngo-proof-expiring:${ngo.id}:${ngo.proofValidUntil}`
          });
          ngo.proofExpiryRemindedAt = now;
          recordAudit(data, "system", "ngo.proof_expiry_reminded", ngo.id, "admin_only");
        }
        return due;
      },
      expireProofs: (now) => {
        const today = now.slice(0, 10);
        const expired = data.ngos.filter(
          (ngo) =>
            ngo.verificationState === "verified" &&
            ngoRequiresProofExpiry(ngo.orgType) &&
            Boolean(ngo.proofValidUntil) &&
            (ngo.proofValidUntil as string) < today
        );
        for (const ngo of expired) {
          ngo.verificationState = "verification_pending";
          ngo.verifiedAt = null;
          ngo.proofExpiryRemindedAt = null;
          notifyNgoProofParties(data, ngo, {
            kind: "ngo_proof_expired",
            title: "Charitable-status proof expired",
            body: "Verification is suspended. Existing matches continue, but no new promises can be made until Ops re-approves a renewed proof.",
            dedupeKey: `ngo-proof-expired:${ngo.id}:${ngo.proofValidUntil}`
          });
          recordAudit(data, "system", "ngo.proof_expired", ngo.id, "admin_only");
        }
        return expired;
      }
    },
    listings: {
      get: (id) => data.listings.find((listing) => listing.id === id),
      listForCompany: (companyId) => data.listings.filter((listing) => listing.companyId === companyId),
      create: (actor, input) => {
        if (actor.role !== "corporate" && !isOpsRole(actor.role)) {
          return { ok: false, reason: "actor_not_allowed" };
        }
        const companyId = actor.role === "corporate" ? actor.companyId : input.companyId;
        if (!companyId || !data.companies.some((company) => company.id === companyId)) {
          return { ok: false, reason: "company_required" };
        }
        // ADR 0027: registration is an application — listing create waits on verification.
        if (!isCompanyVerified(data.companies.find((company) => company.id === companyId))) {
          return { ok: false, reason: "company_not_verified" };
        }
        if (!input.title.trim()) return { ok: false, reason: "invalid_title" };
        if (!input.category.trim()) return { ok: false, reason: "invalid_category" };
        // Optional: an NGO posting "Laptops" or "as many as you have" is not
        // an error. Validate only when a number is actually given.
        if (input.quantity !== undefined && (!Number.isFinite(input.quantity) || input.quantity <= 0)) {
          return { ok: false, reason: "invalid_quantity" };
        }
        if (!Number.isFinite(input.unitValue) || input.unitValue < 0) {
          return { ok: false, reason: "invalid_unit_value" };
        }
        if (!input.city.trim() || !input.country.trim()) {
          return { ok: false, reason: "invalid_location" };
        }
        if (!input.condition.trim()) return { ok: false, reason: "invalid_condition" };
        if (!input.eligibility.usable || !input.eligibility.policyFit || !input.eligibility.ownership) {
          return { ok: false, reason: "eligibility_not_confirmed" };
        }

        const listing: Listing = {
          id: `lst-${data.listings.length + 1}`,
          companyId,
          title: input.title.trim(),
          category: input.category.trim(),
          subcategory: input.subcategory?.trim() || null,
          quantity: input.quantity,
          unit: input.unit?.trim() || "units",
          unitValue: input.unitValue,
          city: input.city.trim(),
          country: input.country.trim(),
          condition: input.condition.trim(),
          state: "open",
          availableUntil: input.availableUntil ?? null,
          pickupWindow: input.pickupWindow?.trim() || "",
          packaging: input.packaging?.trim() || "",
          weightKg: input.weightKg ?? 0,
          categoryDetails: input.categoryDetails?.trim() || "",
          photos: [],
          attachments: [],
          reviewFlags: [],
          eligibility: {
            usable: input.eligibility.usable,
            policyFit: input.eligibility.policyFit,
            ownership: input.eligibility.ownership
          },
          createdAt: nowIso()
        };
        data.listings.push(listing);
        recordAudit(data, actor.userId, "listing.created", listing.id, "customer_visible");
        return { ok: true, listing };
      }
    },
    donationCases: {
      get: (id) => data.donationCases.find((item) => item.id === id),
      listForCompany: (companyId) =>
        data.donationCases.filter((item) => item.companyId === companyId),
      create: (actor, input) => {
        if (actor.role !== "corporate" && !isOpsRole(actor.role)) {
          return { ok: false, reason: "actor_not_allowed" };
        }
        const companyId = actor.role === "corporate" ? actor.companyId : input.companyId;
        if (!companyId || !data.companies.some((company) => company.id === companyId)) {
          return { ok: false, reason: "company_required" };
        }
        if (!isCompanyVerified(data.companies.find((company) => company.id === companyId))) {
          return { ok: false, reason: "company_not_verified" };
        }
        if (!input.title.trim()) return { ok: false, reason: "invalid_title" };
        if (!input.contactName.trim() || !input.contactEmail.trim()) {
          return { ok: false, reason: "invalid_contact" };
        }
        if (!input.city.trim() || !input.country.trim()) {
          return { ok: false, reason: "invalid_location" };
        }

        const donationCase: DonationCase = {
          id: `case-${data.donationCases.length + 1}`,
          companyId,
          title: input.title.trim(),
          step: 1,
          contactName: input.contactName.trim(),
          contactEmail: input.contactEmail.trim(),
          contactPhone: input.contactPhone?.trim() || null,
          city: input.city.trim(),
          country: input.country.trim(),
          locationNotes: input.locationNotes?.trim() || null,
          timeWindow: input.timeWindow?.trim() || null,
          availableFrom: input.availableFrom ?? null,
          availableUntil: input.availableUntil ?? null,
          confirmedAt: null,
          createdAt: nowIso()
        };
        data.donationCases.push(donationCase);
        recordAudit(data, actor.userId, "donation_case.created", donationCase.id, "customer_visible");
        return { ok: true, donationCase };
      },
      addPosition: (actor, caseId, input) => {
        const access = resolveDonationCaseAccess(actor, caseId, data);
        if (!access.ok) return access;
        const validated = validateDonationPositionInput(input);
        if (!validated.ok) return validated;

        const position = pushDonationPosition(data, access.donationCase, validated.input);
        reopenDonationCaseConfirmation(data, actor.userId, access.donationCase);
        advanceCaseToInventory(access.donationCase);
        recordAudit(data, actor.userId, "donation_position.created", position.id, "customer_visible");
        return { ok: true, position, donationCase: access.donationCase };
      },
      importPositions: (actor, caseId, inputs) => {
        const access = resolveDonationCaseAccess(actor, caseId, data);
        if (!access.ok) return access;
        if (inputs.length === 0) return { ok: false, reason: "empty_positions" };
        if (inputs.length > 500) return { ok: false, reason: "too_many_positions" };

        const positions: DonationPosition[] = [];
        for (const input of inputs) {
          const validated = validateDonationPositionInput(input);
          if (!validated.ok) return validated;
          positions.push(pushDonationPosition(data, access.donationCase, validated.input));
        }
        reopenDonationCaseConfirmation(data, actor.userId, access.donationCase);
        advanceCaseToInventory(access.donationCase);
        recordAudit(
          data,
          actor.userId,
          `donation_positions.imported:${positions.length}`,
          access.donationCase.id,
          "customer_visible"
        );
        return { ok: true, positions, donationCase: access.donationCase };
      },
      confirm: (actor, caseId) => {
        const access = resolveDonationCaseAccess(actor, caseId, data);
        if (!access.ok) return access;
        if (access.donationCase.confirmedAt) {
          return { ok: false, reason: "already_confirmed" };
        }
        const positions = data.donationPositions.filter(
          (item) => item.caseId === access.donationCase.id
        );
        if (positions.length === 0) {
          return { ok: false, reason: "nothing_to_confirm" };
        }

        const confirmedAt = nowIso();
        access.donationCase.confirmedAt = confirmedAt;
        access.donationCase.step = 4 as DonationCaseStep;
        for (const position of positions) {
          if (position.state !== "ready") continue;
          // Active claims survive a reopen (ADR 0037); re-confirm restores
          // `allocated` for those positions instead of plain `confirmed`.
          position.state =
            activeAllocatedQuantity(data.donationAllocations, position.id) > 0
              ? "allocated"
              : "confirmed";
        }
        recordAudit(
          data,
          actor.userId,
          "donation_case.confirmed",
          access.donationCase.id,
          "customer_visible"
        );
        return { ok: true, donationCase: access.donationCase };
      }
    },
    donationPositions: {
      get: (id) => data.donationPositions.find((item) => item.id === id),
      listForCase: (caseId) => data.donationPositions.filter((item) => item.caseId === caseId)
    },
    donationAllocations: {
      get: (id) => data.donationAllocations.find((item) => item.id === id),
      listForCase: (caseId) => data.donationAllocations.filter((item) => item.caseId === caseId),
      listForNgo: (ngoId) => data.donationAllocations.filter((item) => item.ngoId === ngoId),
      create: (actor, caseId, input) => {
        // Founder decision (2026-11-19, ADR 0037): only Ops allocates.
        if (!isOpsRole(actor.role)) {
          return { ok: false, reason: "actor_not_allowed" };
        }
        // Same order as create_donation_allocation (0073): company verified →
        // confirmation gate.
        const donationCase = data.donationCases.find((item) => item.id === caseId);
        if (!donationCase) return { ok: false, reason: "case_not_found" };
        if (
          !isCompanyVerified(data.companies.find((item) => item.id === donationCase.companyId))
        ) {
          return { ok: false, reason: "company_not_verified" };
        }
        const gate = assertDonationCaseAllocatable(donationCase);
        if (!gate.ok) return gate;

        const position = data.donationPositions.find((item) => item.id === input.positionId);
        if (!position || position.caseId !== caseId) {
          return { ok: false, reason: "position_not_found" };
        }
        if (position.state !== "confirmed" && position.state !== "allocated") {
          return { ok: false, reason: "position_not_allocatable" };
        }

        const ngo = data.ngos.find((item) => item.id === input.ngoId);
        if (!ngo) return { ok: false, reason: "ngo_not_found" };
        if (!isNgoVerified(ngo)) return { ok: false, reason: "ngo_not_verified" };

        if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
          return { ok: false, reason: "invalid_quantity" };
        }
        const already = activeAllocatedQuantity(data.donationAllocations, position.id);
        if (already + input.quantity > position.quantity) {
          return { ok: false, reason: "quantity_exceeds_available" };
        }

        const allocation: DonationAllocation = {
          id: `alloc-${data.donationAllocations.length + 1}`,
          positionId: position.id,
          caseId: donationCase.id,
          ngoId: ngo.id,
          quantity: input.quantity,
          state: "active",
          positionModel: position.model,
          caseTitle: donationCase.title,
          releaseNote: null,
          releasedAt: null,
          createdAt: nowIso()
        };
        data.donationAllocations.push(allocation);
        if (position.state === "confirmed") position.state = "allocated";
        recordAudit(
          data,
          actor.userId,
          "donation_allocation.created",
          allocation.id,
          "customer_visible"
        );
        return { ok: true, allocation, position };
      },
      release: (actor, allocationId, input) => {
        const allocation = data.donationAllocations.find((item) => item.id === allocationId);
        if (!allocation) return { ok: false, reason: "allocation_not_found" };
        if (allocation.state !== "active") {
          return { ok: false, reason: "allocation_not_active" };
        }

        const isOps = isOpsRole(actor.role);
        const isOwningNgo = actor.role === "ngo" && actor.ngoId === allocation.ngoId;
        if (!isOps && !isOwningNgo) {
          return { ok: false, reason: "actor_not_allowed" };
        }

        const note = input.releaseNote.trim();
        if (!note) return { ok: false, reason: "invalid_release_note" };

        allocation.state = "released";
        allocation.releaseNote = note;
        allocation.releasedAt = nowIso();

        const position = data.donationPositions.find((item) => item.id === allocation.positionId);
        if (!position) return { ok: false, reason: "position_not_found" };
        if (activeAllocatedQuantity(data.donationAllocations, position.id) === 0) {
          if (position.state === "allocated") position.state = "confirmed";
        }

        recordAudit(
          data,
          actor.userId,
          "donation_allocation.released",
          allocation.id,
          "customer_visible"
        );
        return { ok: true, allocation, position };
      }
    },
    needs: {
      get: (id) => data.needs.find((need) => need.id === id),
      listForNgo: (ngoId) => data.needs.filter((need) => need.ngoId === ngoId),
      create: (actor, input) => {
        if (actor.role !== "ngo" && !isOpsRole(actor.role)) {
          return { ok: false, reason: "actor_not_allowed" };
        }
        const ngoId = actor.role === "ngo" ? actor.ngoId : input.ngoId;
        if (!ngoId || !data.ngos.some((ngo) => ngo.id === ngoId)) {
          return { ok: false, reason: "ngo_required" };
        }
        if (!input.title.trim()) return { ok: false, reason: "invalid_title" };
        if (!input.category.trim()) return { ok: false, reason: "invalid_category" };
        // Optional: an NGO posting "Laptops" or "as many as you have" is not
        // an error. Validate only when a number is actually given.
        if (input.quantity !== undefined && (!Number.isFinite(input.quantity) || input.quantity <= 0)) {
          return { ok: false, reason: "invalid_quantity" };
        }
        if (!input.city.trim() || !input.country.trim()) {
          return { ok: false, reason: "invalid_location" };
        }
        if (input.beneficiaries !== undefined && (!Number.isFinite(input.beneficiaries) || input.beneficiaries < 0)) {
          return { ok: false, reason: "invalid_beneficiaries" };
        }
        const deliveryPreference = input.deliveryPreference ?? "either";
        if (!isNeedDeliveryPreference(deliveryPreference)) {
          return { ok: false, reason: "invalid_delivery_preference" };
        }
        if (
          input.maxQuantityPerMatch !== undefined &&
          input.maxQuantityPerMatch !== null &&
          (!Number.isInteger(input.maxQuantityPerMatch) || input.maxQuantityPerMatch <= 0)
        ) {
          return { ok: false, reason: "invalid_max_quantity_per_match" };
        }
        if (!input.targetGroup?.trim()) {
          return { ok: false, reason: "invalid_target_group" };
        }
        if (!input.deliveryAddress?.trim()) {
          return { ok: false, reason: "invalid_delivery_address" };
        }

        const ngo = data.ngos.find((item) => item.id === ngoId);
        const state = isNgoVerified(ngo) ? "open" : "draft";
        const need: Need = {
          id: `need-${data.needs.length + 1}`,
          ngoId,
          title: input.title.trim(),
          category: input.category.trim(),
          subcategory: input.subcategory?.trim() || null,
          quantity: input.quantity ?? null,
          quantityOpen: input.quantityOpen ?? false,
          urgency: input.urgency ?? "flexible",
          city: input.city.trim(),
          country: input.country.trim(),
          targetDate: input.targetDate ?? null,
          beneficiaries: input.beneficiaries ?? 0,
          deliveryPreference,
          maxQuantityPerMatch: input.maxQuantityPerMatch ?? null,
          targetGroup: input.targetGroup.trim(),
          deliveryAddress: input.deliveryAddress.trim(),
          hasVehicle: input.hasVehicle ?? false,
          state,
          story: input.story?.trim() || "",
          createdAt: nowIso()
        };
        data.needs.push(need);
        recordAudit(
          data,
          actor.userId,
          state === "draft" ? "need.draft_created" : "need.created",
          need.id,
          "customer_visible"
        );
        return { ok: true, need };
      }
    },
    matches: {
      get: (id) => data.matches.find((match) => match.id === id),
      list: (actor) => data.matches.filter((match) => canSeeMatch(match, actor, data)),
      propose: (actor, input) => {
        if (!isOpsRole(actor.role)) return { ok: false, reason: "actor_not_allowed" };

        const listing = data.listings.find((item) => item.id === input.listingId);
        if (!listing) return { ok: false, reason: "listing_not_found" };
        const need = data.needs.find((item) => item.id === input.needId);
        if (!need) return { ok: false, reason: "need_not_found" };
        if (!isCompanyVerified(data.companies.find((item) => item.id === listing.companyId))) {
          return { ok: false, reason: "company_not_verified" };
        }
        if (!isNgoVerified(data.ngos.find((item) => item.id === need.ngoId))) {
          return { ok: false, reason: "ngo_not_verified" };
        }
        if (listing.state !== "open") return { ok: false, reason: "listing_not_open" };
        if (need.state !== "open") return { ok: false, reason: "need_not_open" };
        if (
          data.matches.some(
            (item) => item.listingId === listing.id && item.needId === need.id && item.state !== "expired"
          )
        ) {
          return { ok: false, reason: "match_exists" };
        }

        // One part of the need (ADR 0028 D3): by default what the listing gives
        // and the need still wants. A need that names no quantity has no remainder.
        const open = needOpenQuantity(need, data.matches);
        if (open !== null && open <= 0) return { ok: false, reason: "need_fully_covered" };
        const perMatchCap = need.maxQuantityPerMatch;
        const quantity =
          input.quantity ??
          Math.min(listing.quantity, open ?? listing.quantity, perMatchCap ?? Number.POSITIVE_INFINITY);
        if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "invalid_quantity" };
        if (quantity > listing.quantity) return { ok: false, reason: "quantity_exceeds_listing" };
        if (open !== null && quantity > open) return { ok: false, reason: "quantity_exceeds_open" };
        if (perMatchCap !== null && quantity > perMatchCap) {
          return { ok: false, reason: "quantity_exceeds_max_per_match" };
        }

        // Ops curates the pairing (ADR 0028 D1), so there is no automatic fit
        // score or CO2 estimate yet; both stay 0 until the value tables land.
        const match: Match = {
          id: `mat-${data.matches.length + 1}`,
          listingId: listing.id,
          needId: need.id,
          state: "proposed",
          quantity,
          committedAt: null,
          quotaRefundedAt: null,
          score: 0,
          co2Tons: 0,
          pickupDate: null,
          deliveryDate: null,
          carrier: null,
          trackingRef: null,
          createdAt: nowIso()
        };
        data.matches.push(match);
        listing.state = "match_pending";
        notifyStatusChange(data, match);
        recordAudit(data, actor.userId, "match.proposed", match.id, "customer_visible");
        return { ok: true, match };
      },
      fail: (actor, id, input) => {
        if (!isOpsRole(actor.role)) return { ok: false, reason: "actor_not_allowed" };
        if (typeof input.ngoAtFault !== "boolean") return { ok: false, reason: "invalid_fault" };
        if ((input.reason ?? "").length > 500) return { ok: false, reason: "invalid_reason" };
        const match = data.matches.find((item) => item.id === id);
        if (!match) return { ok: false, reason: "match_not_found" };
        if (isTerminalMatchState(match.state)) return { ok: false, reason: "terminal_state" };
        if (!(MATCH_FAILABLE_STATES as readonly string[]).includes(match.state)) {
          return { ok: false, reason: "not_shipped" };
        }

        match.state = "failed";
        if (!input.ngoAtFault) match.quotaRefundedAt = match.quotaRefundedAt ?? nowIso();
        refreshNeedState(match, data);
        notifyStatusChange(data, match);
        recordAudit(data, actor.userId, "match.failed", id, "customer_visible");
        recordAudit(
          data,
          actor.userId,
          `match.failure_assessed:${input.ngoAtFault ? "ngo_at_fault" : "quota_refunded"}`,
          id,
          "admin_only"
        );
        return { ok: true, match };
      },
      warnExpiring: (now) => {
        const warnFrom = Date.parse(now) - (PROPOSAL_EXPIRY_DAYS - PROPOSAL_EXPIRY_WARNING_DAYS) * 24 * 60 * 60 * 1000;
        const expiresBefore = Date.parse(now) - PROPOSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const due = data.matches.filter(
          (match) =>
            match.state === "proposed" &&
            Date.parse(match.createdAt) <= warnFrom &&
            Date.parse(match.createdAt) > expiresBefore
        );
        for (const match of due) {
          notifyMatchParties(data, match, {
            kind: "proposal_expiring",
            title: "A match proposal is about to expire",
            body: "This proposal has been waiting for a reply and expires in about three days. Open it to confirm or leave it to lapse.",
            dedupeKey: `expiring:${match.id}`
          });
        }
        return due;
      },
      expireStale: (now) => {
        const cutoff = Date.parse(now) - PROPOSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const expired = data.matches.filter(
          (match) => match.state === "proposed" && Date.parse(match.createdAt) <= cutoff
        );
        for (const match of expired) {
          match.state = "expired";
          const listing = listingForMatch(match, data);
          if (listing?.state === "match_pending") listing.state = "open";
          notifyStatusChange(data, match);
          recordAudit(data, "system", "match.expired", match.id, "customer_visible");
        }
        return expired;
      },
      transition: (id, nextState, actor) => {
        const match = data.matches.find((item) => item.id === id);
        if (!match) return { ok: false, reason: "match_not_found" };
        if (isTerminalMatchState(match.state)) {
          return { ok: false, reason: "terminal_state" };
        }
        if (nextState === "cancelled") {
          if (!isOpsRole(actor.role)) return { ok: false, reason: "actor_not_allowed" };
          // After shipping a collapse is a failure, which decides the quota.
          if (!(MATCH_CANCELLABLE_STATES as readonly string[]).includes(match.state)) {
            return { ok: false, reason: "already_shipped" };
          }
          match.state = "cancelled";
          refreshNeedState(match, data);
          notifyStatusChange(data, match);
          recordAudit(data, actor.userId, "match.cancelled", id, "admin_only");
          return { ok: true, match };
        }

        const rule = TRANSITION_RULES.find((item) => item.from === match.state && item.to === nextState);
        if (!rule) return { ok: false, reason: "invalid_transition" };
        if (!rule.canAct(actor, match, data)) return { ok: false, reason: "actor_not_allowed" };
        if (rule.actorVerified && !rule.actorVerified(match, data)) {
          return { ok: false, reason: "org_not_verified" };
        }
        if (wouldExceedMatchQuota(match, nextState, data)) {
          return { ok: false, reason: "match_quota_exceeded" };
        }

        match.state = nextState;
        rule.apply?.(match, data);
        if (nextState === "ngo_confirmed" || nextState === "completed") refreshNeedState(match, data);
        notifyStatusChange(data, match);
        recordAudit(data, actor.userId, `match.${nextState}`, id, "customer_visible");
        return { ok: true, match };
      }
    },
    messages: {
      listForMatch: (matchId, actor) => {
        const match = data.matches.find((item) => item.id === matchId);
        if (!match || !canSeeMatch(match, actor, data)) return [];
        return data.messages.filter(
          (message) => message.matchId === matchId && (isOpsRole(actor.role) || message.visibility === "customer_visible")
        );
      },
      create: (matchId, body, actor) => {
        const text = body.trim();
        if (!text) return { ok: false, reason: "empty_body" };

        const match = data.matches.find((item) => item.id === matchId);
        if (!match) return { ok: false, reason: "match_not_found" };
        if (!canSeeMatch(match, actor, data)) return { ok: false, reason: "actor_not_allowed" };

        const message = appendMessage(data, {
          matchId,
          authorId: actor.userId,
          body: text,
          visibility: "customer_visible"
        });
        recordAudit(data, actor.userId, "message.created", message.id, "customer_visible");
        return { ok: true, message };
      }
    },
    signatureEnvelopes: {
      list: (actor) =>
        data.signatureEnvelopes.filter((envelope) => {
          if (isOpsRole(actor.role)) return true;
          const document = data.documents.find((item) => item.id === envelope.documentId);

          return Boolean(document && canSeeDocument(document, actor, data));
        }),
      create: (actor, input) => {
        if (!isOpsRole(actor.role)) return { ok: false, reason: "actor_not_allowed" };
        if (!input.externalId.trim() || !input.companyEmail.trim() || !input.ngoEmail.trim()) {
          return { ok: false, reason: "invalid_envelope" };
        }
        const document = data.documents.find((item) => item.id === input.documentId);
        if (!document) return { ok: false, reason: "document_not_found" };
        if (document.kind !== "certificate") return { ok: false, reason: "not_signable" };
        const live = (envelope: SignatureEnvelope) => envelope.state !== "declined" && envelope.state !== "voided";
        if (data.signatureEnvelopes.some((envelope) => envelope.documentId === document.id && live(envelope))) {
          return { ok: false, reason: "envelope_exists" };
        }

        const recipient = (partyName: string, partyEmail: string) => ({
          partyName,
          partyEmail: partyEmail.trim().toLowerCase(),
          status: "pending" as const,
          signedAt: null
        });
        const envelope: SignatureEnvelope = {
          id: `env-${data.signatureEnvelopes.length + 1}`,
          documentId: document.id,
          externalId: input.externalId,
          state: "sent",
          recipients: [recipient(input.companyName, input.companyEmail), recipient(input.ngoName, input.ngoEmail)],
          signedStoragePath: null,
          createdAt: nowIso(),
          completedAt: null
        };
        data.signatureEnvelopes.push(envelope);
        recordAudit(data, actor.userId, "document.signature_requested", document.id, "customer_visible");

        return { ok: true, envelope };
      },
      applyDocusealEvent: (input) => {
        const envelope = data.signatureEnvelopes.find((item) => item.externalId === input.externalId);
        if (!envelope) return undefined;
        if (envelope.state === "declined" || envelope.state === "voided") return envelope.state;
        if (envelope.state === "completed" && (input.event !== "completed" || !input.signedStoragePath)) return envelope.state;

        const wasCompleted = envelope.state === "completed";
        const email = input.email?.trim().toLowerCase();
        const who = envelope.recipients.filter((item) => item.partyEmail === email);
        if (input.event === "viewed") {
          for (const item of who) if (item.status === "pending") item.status = "viewed";
        } else if (input.event === "signed") {
          for (const item of who) {
            item.status = "signed";
            item.signedAt = item.signedAt ?? nowIso();
          }
          envelope.state = envelope.recipients.every((item) => item.status === "signed") ? "completed" : "partially_signed";
        } else if (input.event === "declined") {
          for (const item of who) item.status = "declined";
          envelope.state = "declined";
        } else if (input.event === "completed") {
          for (const item of envelope.recipients) {
            item.status = "signed";
            item.signedAt = item.signedAt ?? nowIso();
          }
          envelope.state = "completed";
        } else {
          envelope.state = "voided";
        }

        if (envelope.state === "completed") {
          envelope.completedAt = envelope.completedAt ?? nowIso();
          envelope.signedStoragePath = input.signedStoragePath ?? envelope.signedStoragePath;
          if (!wasCompleted) recordAudit(data, "docuseal", "document.signed", envelope.documentId, "customer_visible");
        } else if (envelope.state === "declined") {
          recordAudit(data, "docuseal", "document.signature_declined", envelope.documentId, "customer_visible");
        }

        return envelope.state;
      }
    },
    co2Factors: {
      list: () => [...data.co2Factors].sort((a, b) => a.category.localeCompare(b.category)),
      set: (actor, input) => {
        if (!isOpsAdminRole(actor.role)) return { ok: false, reason: "actor_not_allowed" };
        const category = input.category.trim();
        if (!category || category.length > 120) return { ok: false, reason: "invalid_category" };
        const value = input.kgCo2ePerKg;
        if (!Number.isFinite(value) || value < 0 || value > CO2_FACTOR_MAX) return { ok: false, reason: "invalid_factor" };

        const rounded = Math.round(value * 1000) / 1000;
        const existing = data.co2Factors.find((item) => item.category === category);
        recordAudit(data, actor.userId, `co2_factor.set:${existing ? existing.kgCo2ePerKg : "none"}->${rounded}`, category, "admin_only");
        if (existing) {
          existing.kgCo2ePerKg = rounded;
          existing.updatedAt = nowIso();

          return { ok: true, factor: existing };
        }
        const factor: Co2Factor = { category, kgCo2ePerKg: rounded, updatedAt: nowIso() };
        data.co2Factors.push(factor);

        return { ok: true, factor };
      }
    },
    notifications: {
      list: (actor) =>
        data.notifications
          .filter((notification) => notification.userId === actor.userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    accessRequests: {
      submit: (input) => {
        const existing = data.accessRequests.find((request) => request.email === input.email);
        if (existing) {
          Object.assign(existing, input);
          return;
        }
        data.accessRequests.unshift({
          id: `acc-${data.accessRequests.length + 1}`,
          ...input,
          status: "new",
          createdAt: nowIso()
        });
      },
      list: (actor) => (isOpsRole(actor.role) ? [...data.accessRequests] : [])
    },
    invitations: {
      list: (actor) => data.invitations.filter((invitation) => canSeeInvitation(invitation, actor)),
      create: (actor, input) => {
        const email = input.email.trim().toLowerCase();
        if (!email || !email.includes("@")) return { ok: false, reason: "invalid_email" };

        const invitation: Invitation = {
          id: `inv-${data.invitations.length + 1}`,
          email,
          role: input.role,
          companyId: input.role === "corporate" ? input.companyId ?? orgCompanyId(actor) ?? null : null,
          ngoId: input.role === "ngo" ? input.ngoId ?? orgNgoId(actor) ?? null : null,
          orgName: input.orgName?.trim() || null,
          status: "pending",
          expiresAt: input.expiresAt ?? null,
          acceptedAt: null,
          acceptedBy: null,
          createdAt: nowIso()
        };

        const validation = validateInvitation(invitation, actor, data);
        if (validation) return { ok: false, reason: validation };

        data.invitations.push(invitation);
        recordAudit(data, actor.userId, "invitation.created", invitation.id, "admin_only");
        return { ok: true, invitation };
      },
      resend: (actor, invitationId) => {
        const invitation = data.invitations.find((item) => item.id === invitationId);
        if (!invitation) return { ok: false, reason: "invitation_not_found" };
        const validation = validateInvitationMutation(invitation, actor);
        if (validation) return { ok: false, reason: validation };

        recordAudit(data, actor.userId, "invitation.resent", invitation.id, "admin_only");
        return { ok: true, invitation };
      },
      revoke: (actor, invitationId) => {
        const invitation = data.invitations.find((item) => item.id === invitationId);
        if (!invitation) return { ok: false, reason: "invitation_not_found" };
        const validation = validateInvitationMutation(invitation, actor);
        if (validation) return { ok: false, reason: validation };

        invitation.status = "revoked";
        recordAudit(data, actor.userId, "invitation.revoked", invitation.id, "admin_only");
        return { ok: true, invitation };
      }
    },
    invitationDeliveries: {
      list: (actor) =>
        data.invitationDeliveryAttempts.filter((attempt) => canSeeInvitationDeliveryAttempt(attempt, actor, data)),
      listForInvitation: (actor, invitationId) =>
        data.invitationDeliveryAttempts.filter(
          (attempt) =>
            attempt.invitationId === invitationId &&
            canSeeInvitationDeliveryAttempt(attempt, actor, data)
        ),
      record: (actor, input) => {
        const invitation = data.invitations.find((item) => item.id === input.invitationId);
        if (!invitation) return { ok: false, reason: "invitation_not_found" };
        if (!canSeeInvitation(invitation, actor)) return { ok: false, reason: "actor_not_allowed" };
        if (actor.role === "corporate" && invitation.role !== "corporate") return { ok: false, reason: "actor_not_allowed" };
        if (actor.role === "ngo" && invitation.role !== "ngo") return { ok: false, reason: "actor_not_allowed" };

        const provider = input.provider.trim();
        if (!provider) return { ok: false, reason: "invalid_delivery_attempt" };

        const attempt: InvitationDeliveryAttempt = {
          id: `del-${data.invitationDeliveryAttempts.length + 1}`,
          invitationId: invitation.id,
          operation: input.operation,
          provider,
          status: input.status,
          messageId: normalizeOptionalDeliveryField(input.messageId),
          error: normalizeOptionalDeliveryField(input.error),
          reason: normalizeOptionalDeliveryField(input.reason),
          actorId: actor.userId,
          createdAt: nowIso()
        };

        data.invitationDeliveryAttempts.unshift(attempt);
        recordAudit(data, actor.userId, `invitation.delivery.${attempt.status}`, invitation.id, "admin_only");
        return { ok: true, attempt };
      }
    },
    auditEvents: {
      list: () => [...data.auditEvents]
    },
    documents: {
      get: (id, actor) => {
        const document = data.documents.find((item) => item.id === id);
        return document && canSeeDocument(document, actor, data) ? document : undefined;
      },
      list: (actor) => data.documents.filter((document) => canSeeDocument(document, actor, data))
    },
    agentRuns: {
      create: (actor, input) => {
        const task = normalizeAgentRunInput(input);
        if (!task) return { ok: false, reason: "invalid_task" };
        if (!hasValidAgentTaskTarget(task)) return { ok: false, reason: "invalid_target" };
        if (!canCreateAgentRunForTarget(task, actor, data)) {
          return { ok: false, reason: "actor_not_allowed" };
        }
        // Social media cards are a Tree feature. Mirrors create_agent_run (0051).
        if (task.taskType === "social_ad" && actor.role === "corporate") {
          const company = data.companies.find((item) => item.id === actor.companyId);
          if (!company || !planAllows(company.plan, "social_media_cards")) {
            return { ok: false, reason: "plan_required" };
          }
        }

        const plan = createDeterministicAgentPlan(task);
        const document = plan.document ? createDraftDocument(data, actor, plan.document) : null;
        const run: AgentRun = {
          id: `run-${data.agentRuns.length + 1}`,
          role: actor.role,
          companyId: actor.role === "corporate" ? actor.companyId : null,
          ngoId: actor.role === "ngo" ? actor.ngoId : null,
          taskType: task.taskType,
          title: plan.title,
          prompt: task.prompt,
          status: plan.proposedActions.length ? "needs_approval" : "completed",
          summary: plan.summary,
          findings: plan.findings,
          attachments: task.attachments ?? [],
          producedDocumentId: document?.id ?? null,
          createdAt: nowIso(),
          completedAt: plan.proposedActions.length ? null : nowIso()
        };
        const actions = plan.proposedActions.map((action, index) =>
          createProposedAction(run.id, action, index, document)
        );

        data.agentRuns.unshift(run);
        data.proposedActions.push(...actions);
        syncAgentRunStatus(run, data);
        recordAudit(data, actor.userId, "agent.run.created", run.id, "admin_only");

        return { ok: true, run, actions, document };
      },
      get: (id, actor) => {
        const run = data.agentRuns.find((item) => item.id === id);
        return run && canSeeAgentRun(run, actor) ? run : undefined;
      },
      list: (actor) => data.agentRuns.filter((run) => canSeeAgentRun(run, actor))
    },
    proposedActions: {
      listForRun: (runId, actor) => {
        const run = data.agentRuns.find((item) => item.id === runId);
        if (!run || !canSeeAgentRun(run, actor)) return [];

        return data.proposedActions.filter((action) => action.runId === runId);
      },
      approve: (id, actor) => {
        const action = data.proposedActions.find((item) => item.id === id);
        const run = action ? data.agentRuns.find((item) => item.id === action.runId) : undefined;
        if (!action || !run) return { ok: false, reason: "action_not_found" };
        if (!canApproveAgentRun(run, actor)) return { ok: false, reason: "actor_not_allowed" };
        if (action.status !== "pending") return { ok: false, reason: "invalid_transition" };

        action.status = "approved";
        action.approvedBy = actor.userId;
        action.approvedAt = nowIso();
        syncAgentRunStatus(run, data);
        recordAudit(data, actor.userId, "agent.action.approved", action.id, "admin_only");
        return { ok: true, action };
      },
      reject: (id, actor) => {
        const action = data.proposedActions.find((item) => item.id === id);
        const run = action ? data.agentRuns.find((item) => item.id === action.runId) : undefined;
        if (!action || !run) return { ok: false, reason: "action_not_found" };
        if (!canApproveAgentRun(run, actor)) return { ok: false, reason: "actor_not_allowed" };
        if (action.status === "executed" || action.status === "rejected") {
          return { ok: false, reason: "invalid_transition" };
        }

        action.status = "rejected";
        syncAgentRunStatus(run, data);
        recordAudit(data, actor.userId, "agent.action.rejected", action.id, "admin_only");
        return { ok: true, action };
      },
      execute: (id, actor) => {
        const action = data.proposedActions.find((item) => item.id === id);
        const run = action ? data.agentRuns.find((item) => item.id === action.runId) : undefined;
        if (!action || !run) return { ok: false, reason: "action_not_found" };
        if (!canApproveAgentRun(run, actor)) return { ok: false, reason: "actor_not_allowed" };
        if (action.status !== "approved" || !action.approvedBy || !action.approvedAt) {
          return { ok: false, reason: "approval_required" };
        }

        action.status = "executed";
        action.executedAt = nowIso();
        applyExecutedAction(action, actor, data);
        syncAgentRunStatus(run, data);
        recordAudit(data, actor.userId, "agent.action.executed", action.id, "customer_visible");
        return { ok: true, action };
      }
    },
    assertReferentialIntegrity: () => referentialIntegrityErrors(data),
    snapshot: () => cloneData(data)
  };
}

export function createSeedData(): RepositoryData {
  return {
    companies: [
      {
        id: "co-acme",
        name: "Acme GmbH",
        plan: "seed",
        status: "active",
        verificationState: "verified",
        verifiedAt: "2026-01-08",
        city: "Munich",
        country: "Germany",
        ownerName: "Lea Weber",
        contactEmail: "lea.weber@example.com",
        reportingEmail: "sustainability@example.com",
        createdAt: "2026-01-05T09:00:00.000Z"
      },
      {
        id: "co-hanse",
        name: "Hanse Retail Group",
        plan: "tree",
        status: "active",
        verificationState: "verified",
        verifiedAt: "2026-01-15",
        city: "Hamburg",
        country: "Germany",
        ownerName: "Jonas Krueger",
        contactEmail: "jonas.krueger@example.com",
        reportingEmail: "impact@example.com",
        createdAt: "2026-01-12T09:00:00.000Z"
      },
      {
        id: "co-nord",
        name: "Nordic Office AB",
        plan: "tree",
        status: "onboarding",
        verificationState: "onboarding",
        verifiedAt: null,
        city: "Malmo",
        country: "Sweden",
        ownerName: "Elin Andersson",
        contactEmail: "elin@example.com",
        reportingEmail: "finance@example.com",
        createdAt: "2026-02-01T09:00:00.000Z"
      }
    ],
    ngos: [
      {
        id: "ngo-kleiderkammer",
        name: "Kleiderkammer e.V.",
        city: "Munich",
        country: "Germany",
        focus: "Clothing aid",
        verificationState: "verified",
        trustScore: 91,
        boardContact: "Anna Becker",
        contactEmail: "anna@example.org",
        contactPhone: "+49 89 123456",
        address: "Beispielstrasse 12, 80331 Munich",
        verifiedAt: "2026-02-08",
        orgType: "verein",
        proofNoticeDate: "2023-01-15",
        proofAssessmentPeriodYears: 5,
        proofValidUntil: "2028-01-15",
        proofExpiryRemindedAt: null,
        createdAt: "2026-01-21T09:00:00.000Z"
      },
      {
        id: "ngo-tafel",
        name: "Tafel Berlin e.V.",
        city: "Berlin",
        country: "Germany",
        focus: "Food distribution",
        verificationState: "pending_info",
        trustScore: 68,
        boardContact: "Sofia Wagner",
        contactEmail: "sofia@example.org",
        contactPhone: "+49 30 987654",
        address: "Beispielweg 4, 10115 Berlin",
        verifiedAt: null,
        orgType: "verein",
        proofNoticeDate: null,
        proofAssessmentPeriodYears: null,
        proofValidUntil: null,
        proofExpiryRemindedAt: null,
        createdAt: "2026-03-03T09:00:00.000Z"
      }
    ],
    users: [
      {
        id: "usr-corporate-acme",
        email: "corporate@sur.plus.demo",
        fullName: "Lena Hoffmann",
        role: "corporate",
        companyId: "co-acme",
        ngoId: null,
        createdAt: "2026-01-05T09:00:00.000Z"
      },
      {
        id: "usr-ngo-kleiderkammer",
        email: "ngo@sur.plus.demo",
        fullName: "Anna Becker",
        role: "ngo",
        companyId: null,
        ngoId: "ngo-kleiderkammer",
        createdAt: "2026-01-21T09:00:00.000Z"
      },
      {
        id: "usr-admin-ops",
        email: "admin@sur.plus.demo",
        fullName: "sur.plus Ops",
        role: "admin",
        companyId: null,
        ngoId: null,
        createdAt: "2026-01-01T09:00:00.000Z"
      },
      {
        id: "usr-editor-ops",
        email: "editor@sur.plus.demo",
        fullName: "sur.plus Editor",
        role: "editor",
        companyId: null,
        ngoId: null,
        createdAt: "2026-01-02T09:00:00.000Z"
      }
    ],
    invitations: [
      {
        id: "inv-ngo-logistics",
        email: "logistics@kleiderkammer.example",
        role: "ngo",
        companyId: null,
        ngoId: "ngo-kleiderkammer",
        orgName: "Kleiderkammer Berlin",
        status: "pending",
        expiresAt: "2026-07-15",
        acceptedAt: null,
        acceptedBy: null,
        createdAt: "2026-06-12T09:00:00.000Z"
      }
    ],
    accessRequests: [],
    notifications: [],
    companyChecks: [],
    co2Factors: [],
    signatureEnvelopes: [],
    invitationDeliveryAttempts: [
      {
        id: "del-inv-ngo-logistics-1",
        invitationId: "inv-ngo-logistics",
        operation: "create",
        provider: "not_configured",
        status: "skipped",
        messageId: null,
        error: null,
        reason: "email_provider_not_configured",
        actorId: "usr-admin-ops",
        createdAt: "2026-06-12T09:01:00.000Z"
      }
    ],
    donationCases: [
      {
        id: "case-office-move",
        companyId: "co-acme",
        title: "Munich office move — Q2 surplus",
        step: 2,
        contactName: "Lea Weber",
        contactEmail: "lea.weber@example.com",
        contactPhone: "+49 89 1000",
        city: "Munich",
        country: "Germany",
        locationNotes: "Loading bay B, ring warehouse desk",
        timeWindow: "Weekdays 09:00–16:00",
        availableFrom: "2026-06-01",
        availableUntil: "2026-06-30",
        confirmedAt: null,
        createdAt: "2026-05-20T09:00:00.000Z"
      }
    ],
    donationPositions: [
      {
        id: "pos-office-laptops",
        caseId: "case-office-move",
        category: "IT & Electronics",
        model: "Lenovo ThinkPad L14 Gen 3",
        quantity: 40,
        condition: "Good",
        provenance: "Employee refresh — wiped, chargers included",
        state: "ready",
        createdAt: "2026-05-20T10:00:00.000Z"
      },
      {
        id: "pos-office-chairs",
        caseId: "case-office-move",
        category: "Office & facility furniture",
        model: "Herman Miller Aeron (size B)",
        quantity: 24,
        condition: "Fair",
        provenance: "Floor 3 clear-out",
        state: "ready",
        createdAt: "2026-05-20T10:05:00.000Z"
      }
    ],
    donationAllocations: [],
    listings: [
      {
        id: "lst-thinkpads",
        companyId: "co-acme",
        title: "Lenovo ThinkPad L14 Gen 3",
        category: "IT & Electronics",
        subcategory: "Laptops",
        quantity: 200,
        unit: "units",
        unitValue: 71,
        city: "Munich",
        country: "Germany",
        condition: "Good",
        state: "match_pending",
        availableUntil: "2026-06-18",
        pickupWindow: "Weekdays, 09:00-16:00",
        packaging: "Palletized",
        weightKg: 820,
        categoryDetails: "Chargers included. Devices wiped to GDPR standard; serial CSV available.",
        photos: ["thinkpad-front.jpg", "thinkpad-pallet.jpg"],
        attachments: ["thinkpad-serials.csv", "wipe-summary.pdf"],
        reviewFlags: ["admin_review_category", "data_wipe_documented", "high_value"],
        eligibility: { usable: true, policyFit: true, ownership: true },
        createdAt: "2026-05-12T09:00:00.000Z"
      },
      {
        id: "lst-standing-desks",
        companyId: "co-acme",
        title: "Standing desks",
        category: "Office & facility furniture",
        subcategory: "Desks",
        quantity: 48,
        unit: "units",
        unitValue: 95,
        city: "Munich",
        country: "Germany",
        condition: "Good",
        state: "open",
        availableUntil: "2026-07-15",
        pickupWindow: "Fridays, 10:00-15:00",
        packaging: "Loose",
        weightKg: 640,
        categoryDetails: "Mixed dimensions; disassembly required.",
        photos: ["desks-room.jpg"],
        attachments: [],
        reviewFlags: ["disassembly_required"],
        eligibility: { usable: true, policyFit: true, ownership: true },
        createdAt: "2026-05-28T09:00:00.000Z"
      },
      {
        id: "lst-jackets",
        companyId: "co-hanse",
        title: "Winter jackets",
        category: "Textiles, clothing & workwear",
        subcategory: "Workwear",
        quantity: 360,
        unit: "units",
        unitValue: 24,
        city: "Hamburg",
        country: "Germany",
        condition: "New",
        state: "confirmed",
        availableUntil: "2026-06-30",
        pickupWindow: "Weekdays, 08:00-13:00",
        packaging: "Boxed",
        weightKg: 420,
        categoryDetails: "Size mix documented in attachment.",
        photos: ["jackets-boxes.jpg"],
        attachments: ["size-mix.xlsx"],
        reviewFlags: [],
        eligibility: { usable: true, policyFit: true, ownership: true },
        createdAt: "2026-05-20T09:00:00.000Z"
      }
    ],
    needs: [
      {
        id: "need-laptops",
        ngoId: "ngo-kleiderkammer",
        title: "Laptops for training room",
        category: "IT & Electronics",
        subcategory: null,
        quantity: 45,
        quantityOpen: false,
        urgency: "by_date",
        city: "Munich",
        country: "Germany",
        targetDate: "2026-07-01",
        beneficiaries: 180,
        deliveryPreference: "either",
        maxQuantityPerMatch: null,
        targetGroup: "Evening-class participants aged 16–25",
        deliveryAddress: "Lagerhalle 2, Sendlinger Str. 12",
        hasVehicle: true,
        state: "open",
        story: "Digital literacy classes need wiped laptops for evening courses.",
        createdAt: "2026-05-01T09:00:00.000Z"
      },
      {
        id: "need-study-desks",
        ngoId: "ngo-kleiderkammer",
        title: "Study desks for youth center",
        category: "Office & facility furniture",
        subcategory: null,
        quantity: 24,
        quantityOpen: false,
        urgency: "by_date",
        city: "Munich",
        country: "Germany",
        targetDate: "2026-07-20",
        beneficiaries: 90,
        deliveryPreference: "ship",
        maxQuantityPerMatch: null,
        targetGroup: "Youth centre homework groups",
        deliveryAddress: "Jugendzentrum West, Am Westpark 4",
        hasVehicle: false,
        state: "open",
        story: "Homework rooms are being expanded before the new school year.",
        createdAt: "2026-05-18T09:00:00.000Z"
      },
      {
        id: "need-jackets",
        ngoId: "ngo-kleiderkammer",
        title: "Winter clothing for families",
        category: "Textiles, clothing & workwear",
        subcategory: null,
        quantity: 200,
        quantityOpen: false,
        urgency: "by_date",
        city: "Munich",
        country: "Germany",
        targetDate: "2026-11-01",
        beneficiaries: 180,
        deliveryPreference: "collect",
        maxQuantityPerMatch: 50,
        targetGroup: "Families in emergency housing",
        deliveryAddress: "Kleiderkammer Empfang, Dachauer Str. 90",
        hasVehicle: true,
        state: "matched",
        story: "Warm clothing is needed for family support packages.",
        createdAt: "2026-05-15T09:00:00.000Z"
      }
    ],
    matches: [
      {
        id: "mat-thinkpads",
        listingId: "lst-thinkpads",
        needId: "need-laptops",
        state: "proposed",
        quantity: 45,
        committedAt: null,
        quotaRefundedAt: null,
        score: 94,
        co2Tons: 8.6,
        pickupDate: "2026-06-21",
        deliveryDate: "2026-06-25",
        carrier: null,
        trackingRef: null,
        createdAt: "2026-06-01T09:00:00.000Z"
      },
      {
        id: "mat-jackets",
        listingId: "lst-jackets",
        needId: "need-jackets",
        state: "both_confirmed",
        quantity: 200,
        committedAt: "2026-06-05T09:00:00.000Z",
        quotaRefundedAt: null,
        score: 89,
        co2Tons: 4.2,
        pickupDate: "2026-06-12",
        deliveryDate: "2026-06-15",
        carrier: "sur.plus ops",
        trackingRef: "OPS-2026-044",
        createdAt: "2026-06-03T09:00:00.000Z"
      }
    ],
    messages: [
      {
        id: "msg-thinkpads-1",
        matchId: "mat-thinkpads",
        authorId: "usr-admin-ops",
        body: "Initial fit looks strong; waiting for NGO confirmation.",
        visibility: "customer_visible",
        createdAt: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "msg-thinkpads-internal",
        matchId: "mat-thinkpads",
        authorId: "usr-admin-ops",
        body: "Check serial CSV before releasing final contact details.",
        visibility: "admin_only",
        createdAt: "2026-06-01T10:05:00.000Z"
      }
    ],
    documents: [
      {
        id: "doc-csrd-thinkpads",
        kind: "report",
        title: "CSRD evidence note · ThinkPad reuse",
        status: "approved",
        companyId: "co-acme",
        ngoId: null,
        matchId: "mat-thinkpads",
        storagePath: "demo/csrd-thinkpads.pdf",
        mime: "application/pdf",
        sizeBytes: 184000,
        createdBy: "usr-admin-ops",
        createdAt: "2026-06-04T09:00:00.000Z",
        publishedAt: "2026-06-04T12:00:00.000Z"
      },
      {
        id: "doc-donation-certificate-thinkpads",
        kind: "certificate",
        title: "Donation certificate draft · ThinkPad batch",
        status: "draft",
        companyId: "co-acme",
        ngoId: null,
        matchId: "mat-thinkpads",
        storagePath: "demo/donation-certificate-thinkpads.pdf",
        mime: "application/pdf",
        sizeBytes: 126000,
        createdBy: "usr-admin-ops",
        createdAt: "2026-06-04T10:00:00.000Z",
        publishedAt: null
      },
      {
        id: "doc-logistics-tracker-thinkpads",
        kind: "upload",
        title: "Logistics tracker · Munich pickup",
        status: "in_review",
        companyId: "co-acme",
        ngoId: null,
        matchId: "mat-thinkpads",
        storagePath: "demo/logistics-tracker-thinkpads.xlsx",
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 98000,
        createdBy: "usr-corporate-acme",
        createdAt: "2026-06-05T09:00:00.000Z",
        publishedAt: null
      },
      {
        id: "doc-impact-card-thinkpads",
        kind: "social_ad",
        title: "Impact card draft · 45 laptops for training",
        status: "draft",
        companyId: "co-acme",
        ngoId: null,
        matchId: "mat-thinkpads",
        storagePath: "demo/impact-card-thinkpads.png",
        mime: "image/png",
        sizeBytes: 340000,
        createdBy: "usr-corporate-acme",
        createdAt: "2026-06-05T11:00:00.000Z",
        publishedAt: null
      },
      {
        id: "doc-ngo-capacity-kleiderkammer",
        kind: "upload",
        title: "Capacity proof · training room intake",
        status: "approved",
        companyId: null,
        ngoId: "ngo-kleiderkammer",
        matchId: null,
        storagePath: "demo/ngo-capacity-kleiderkammer.pdf",
        mime: "application/pdf",
        sizeBytes: 76000,
        createdBy: "usr-ngo-kleiderkammer",
        createdAt: "2026-06-03T09:00:00.000Z",
        publishedAt: "2026-06-03T13:00:00.000Z"
      }
    ],
    auditEvents: [
      {
        id: "aud-seed-import",
        actor: "system",
        action: "seed.imported",
        target: "repository",
        visibility: "admin_only",
        createdAt: "2026-06-01T09:00:00.000Z"
      }
    ],
    agentRuns: [
      {
        id: "run-match-loop-acme",
        role: "corporate",
        companyId: "co-acme",
        ngoId: null,
        taskType: "match_review",
        title: "Review ThinkPad match before outreach",
        prompt: "Assess the proposed ThinkPad match, summarize risks, and draft only human-approved next steps.",
        status: "needs_approval",
        summary: "Strong fit, but outreach and contact unlock must wait for explicit confirmation.",
        findings: [
          {
            label: "Fit",
            detail: "Need category, location and quantity fit the ThinkPad batch.",
            severity: "info"
          },
          {
            label: "Trust boundary",
            detail: "NGO contact details stay hidden until both sides confirm.",
            severity: "warning"
          }
        ],
        attachments: [],
        producedDocumentId: null,
        createdAt: "2026-06-02T09:00:00.000Z",
        completedAt: null
      }
    ],
    proposedActions: [
      {
        id: "act-draft-ngo-message",
        runId: "run-match-loop-acme",
        label: "Draft NGO confirmation message",
        description: "Prepare a message for the NGO, but do not send it until a human approves.",
        status: "pending",
        riskLevel: "medium",
        targetType: "message",
        targetId: "mat-thinkpads",
        proposedPayload: {
          body: "Could you confirm whether the training room can receive 45 wiped laptops in late June?"
        },
        requiresHumanApproval: true,
        approvedBy: null,
        approvedAt: null,
        executedAt: null
      },
      {
        id: "act-request-data-wipe-review",
        runId: "run-match-loop-acme",
        label: "Request data-wipe review",
        description: "Flag the serial CSV and wipe summary for admin review before contact data unlock.",
        status: "pending",
        riskLevel: "high",
        targetType: "listing",
        targetId: "lst-thinkpads",
        proposedPayload: {
          reviewFlag: "data_wipe_review_required"
        },
        requiresHumanApproval: true,
        approvedBy: null,
        approvedAt: null,
        executedAt: null
      }
    ],
    schedulerJobRuns: [
      {
        id: "job-expire-failed-demo",
        jobName: "expire_stale_proposals",
        startedAt: "2026-06-03T03:15:00.000Z",
        finishedAt: "2026-06-03T03:15:01.000Z",
        recordsProcessed: null,
        status: "failed",
        errorText: "Demo failure so Ops can see a scheduler task in /demo.",
        acknowledgedAt: null,
        acknowledgedBy: null,
        createdAt: "2026-06-03T03:15:00.000Z"
      }
    ]
  };
}

function canSeeMatch(match: Match, actor: ActorContext, data: RepositoryData): boolean {
  if (actor.role === "admin" || actor.role === "editor") return true;
  const listing = listingForMatch(match, data);
  const need = needForMatch(match, data);
  if (actor.role === "corporate") return listing?.companyId === actor.companyId;
  return need?.ngoId === actor.ngoId;
}

function canSeeInvitation(invitation: Invitation, actor: ActorContext): boolean {
  if (actor.role === "admin" || actor.role === "editor") return true;
  if (actor.role === "corporate") return invitation.companyId === actor.companyId;
  return invitation.ngoId === actor.ngoId;
}

function canSeeUser(user: User, actor: ActorContext): boolean {
  if (actor.role === "admin" || actor.role === "editor") return true;
  if (actor.role === "corporate") return user.role === "corporate" && user.companyId === actor.companyId;
  return user.role === "ngo" && user.ngoId === actor.ngoId;
}

function canSeeInvitationDeliveryAttempt(
  attempt: InvitationDeliveryAttempt,
  actor: ActorContext,
  data: RepositoryData
): boolean {
  const invitation = data.invitations.find((item) => item.id === attempt.invitationId);
  return invitation ? canSeeInvitation(invitation, actor) : false;
}

function validateInvitation(
  invitation: Invitation,
  actor: ActorContext,
  data: RepositoryData
): string | null {
  if (!canSeeInvitation(invitation, actor)) return "actor_not_allowed";
  if (actor.role === "corporate" && invitation.role !== "corporate") return "actor_not_allowed";
  if (actor.role === "ngo" && invitation.role !== "ngo") return "actor_not_allowed";

  if (invitation.role === "corporate") {
    if (!invitation.companyId || invitation.ngoId) return "invalid_scope";
    const company = data.companies.find((item) => item.id === invitation.companyId);
    if (!company) return "company_not_found";

    const duplicate = data.invitations.some(
      (item) =>
        item.status === "pending" &&
        item.role === "corporate" &&
        item.companyId === invitation.companyId &&
        item.email === invitation.email
    );
    if (duplicate) return "pending_invitation_exists";

    const seatsInUse = countCorporateSeatsInUse(data, invitation.companyId);
    if (seatsInUse >= PLAN_ENTITLEMENTS[company.plan].userSeats) {
      return "seat_limit_exceeded";
    }
    return null;
  }

  if (!invitation.ngoId || invitation.companyId) return "invalid_scope";
  if (!data.ngos.some((item) => item.id === invitation.ngoId)) return "ngo_not_found";

  return null;
}

function validateInvitationMutation(invitation: Invitation, actor: ActorContext): string | null {
  if (!canSeeInvitation(invitation, actor)) return "actor_not_allowed";
  if (actor.role === "corporate" && invitation.role !== "corporate") return "actor_not_allowed";
  if (actor.role === "ngo" && invitation.role !== "ngo") return "actor_not_allowed";
  if (invitation.status !== "pending") return "invitation_not_pending";

  return null;
}

function countCorporateSeatsInUse(data: RepositoryData, companyId: string): number {
  const users = data.users.filter((user) => user.role === "corporate" && user.companyId === companyId).length;
  const pendingInvitations = data.invitations.filter(
    (invitation) =>
      invitation.status === "pending" &&
      invitation.role === "corporate" &&
      invitation.companyId === companyId
  ).length;

  return users + pendingInvitations;
}

function orgCompanyId(actor: ActorContext): string | undefined {
  return actor.role === "corporate" ? actor.companyId : undefined;
}

function orgNgoId(actor: ActorContext): string | undefined {
  return actor.role === "ngo" ? actor.ngoId : undefined;
}

function wouldExceedMatchQuota(match: Match, nextState: MatchState, data: RepositoryData): boolean {
  if (match.committedAt !== null || nextState !== "both_confirmed") return false;

  const listing = listingForMatch(match, data);
  const company = listing ? data.companies.find((item) => item.id === listing.companyId) : undefined;
  if (!company) return false;

  const allowance = PLAN_ENTITLEMENTS[company.plan].matchesPerYear;
  if (allowance === null) return false;

  const year = new Date(match.createdAt).getUTCFullYear();
  return countCommittedMatches(data, company.id, year) >= allowance;
}

function countCommittedMatches(data: RepositoryData, companyId: string, year: number): number {
  return data.matches.filter((match) => {
    const listing = listingForMatch(match, data);
    return (
      listing?.companyId === companyId &&
      new Date(match.createdAt).getUTCFullYear() === year &&
      holdsQuota(match)
    );
  }).length;
}

function canCreateAgentRunForTarget(input: AgentRunInput, actor: ActorContext, data: RepositoryData): boolean {
  if (!input.targetType || !input.targetId) return true;

  if (input.targetType === "match") {
    const match = data.matches.find((item) => item.id === input.targetId);
    return Boolean(match && canSeeMatch(match, actor, data));
  }

  if (input.targetType === "listing") {
    const listing = data.listings.find((item) => item.id === input.targetId);
    return Boolean(listing && (isOpsRole(actor.role) || (actor.role === "corporate" && listing.companyId === actor.companyId)));
  }

  if (input.targetType === "document") {
    const document = data.documents.find((item) => item.id === input.targetId);
    return Boolean(document && canSeeDocument(document, actor, data));
  }

  return false;
}

function hasValidAgentTaskTarget(input: AgentRunInput): boolean {
  if (input.taskType === "match_review" || input.taskType === "message_draft") {
    return input.targetType === "match" && Boolean(input.targetId);
  }

  return !input.targetType || Boolean(input.targetId);
}

function canSeeDocument(document: Document, actor: ActorContext, data: RepositoryData): boolean {
  if (isOpsRole(actor.role)) return true;
  // Documents are for verified organisations only (ADR 0027).
  if (actor.role === "corporate" && !isCompanyVerified(data.companies.find((item) => item.id === actor.companyId))) {
    return false;
  }
  if (actor.role === "ngo" && !isNgoVerified(data.ngos.find((item) => item.id === actor.ngoId))) return false;
  if (actor.role === "corporate" && document.companyId === actor.companyId) return true;
  if (actor.role === "ngo" && document.ngoId === actor.ngoId) return true;

  const match = document.matchId ? data.matches.find((item) => item.id === document.matchId) : undefined;
  return Boolean(match && canSeeMatch(match, actor, data));
}

function listingForMatch(match: Match, data: RepositoryData): Listing | undefined {
  return data.listings.find((listing) => listing.id === match.listingId);
}

/**
 * The need follows its matches: matched once the confirmed parts cover it,
 * fulfilled once the completed parts do, open again when a part falls away.
 * A need that names no quantity is covered by any single match. Mirrors
 * refresh_need_state() (0039); a closed need stays closed.
 */
function refreshNeedState(match: Match, data: RepositoryData): void {
  const need = needForMatch(match, data);
  // Drafts stay off the market until verification promotes them; never rewrite.
  if (!need || need.state === "closed" || need.state === "draft") return;

  const confirmedStates: MatchState[] = ["ngo_confirmed", "both_confirmed", "in_transit", "delivered", "completed"];
  const forNeed = data.matches.filter((item) => item.needId === need.id);
  const confirmed = forNeed.filter((item) => confirmedStates.includes(item.state)).reduce((sum, item) => sum + item.quantity, 0);
  const completed = forNeed.filter((item) => item.state === "completed").reduce((sum, item) => sum + item.quantity, 0);
  const target = need.quantity || 1;
  const [done, covered] = need.quantity ? [completed, confirmed] : [Math.min(completed, 1), Math.min(confirmed, 1)];

  need.state = done >= target ? "fulfilled" : covered >= target ? "matched" : "open";
}

/** Every user of the listing's company and of the need's NGO, once per dedupe key. Mirrors notify_match_parties (0042). */
function normalizeVerificationInput(
  input: NgoVerificationAction | NgoVerificationInput
): NgoVerificationInput {
  return typeof input === "string" ? { action: input } : input;
}

function applyProofValidityOnApprove(
  ngo: Ngo,
  input: NgoVerificationInput
): { ok: true } | { ok: false; reason: string } {
  if (!ngoRequiresProofExpiry(ngo.orgType)) {
    ngo.proofNoticeDate = null;
    ngo.proofAssessmentPeriodYears = null;
    ngo.proofValidUntil = null;
    ngo.proofExpiryRemindedAt = null;
    return { ok: true };
  }

  const notice = input.proofNoticeDate?.trim() || null;
  const years = input.proofAssessmentPeriodYears ?? null;
  if (!notice || years === null) {
    return { ok: false, reason: "proof_validity_required" };
  }
  try {
    ngo.proofNoticeDate = notice;
    ngo.proofAssessmentPeriodYears = years;
    ngo.proofValidUntil = deriveProofValidUntil(notice, years);
    ngo.proofExpiryRemindedAt = null;
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_proof_notice_date";
    return { ok: false, reason: message };
  }
}

function notifyNgoProofParties(
  data: RepositoryData,
  ngo: Ngo,
  message: Pick<Notification, "kind" | "title" | "body" | "dedupeKey">
): void {
  for (const user of data.users) {
    const isParty = user.ngoId === ngo.id || user.role === "admin" || user.role === "editor";
    if (!isParty) continue;
    if (data.notifications.some((item) => item.userId === user.id && item.dedupeKey === message.dedupeKey)) {
      continue;
    }
    data.notifications.push({
      id: `ntf-${data.notifications.length + 1}`,
      userId: user.id,
      matchId: null,
      createdAt: nowIso(),
      ...message
    });
  }
}

function notifyMatchParties(
  data: RepositoryData,
  match: Match,
  message: Pick<Notification, "kind" | "title" | "body" | "dedupeKey">
): void {
  const companyId = listingForMatch(match, data)?.companyId;
  const ngoId = needForMatch(match, data)?.ngoId;
  for (const user of data.users) {
    const isParty = (companyId && user.companyId === companyId) || (ngoId && user.ngoId === ngoId);
    if (!isParty) continue;
    if (data.notifications.some((item) => item.userId === user.id && item.dedupeKey === message.dedupeKey)) continue;
    data.notifications.push({
      id: `ntf-${data.notifications.length + 1}`,
      userId: user.id,
      matchId: match.id,
      createdAt: nowIso(),
      ...message
    });
  }
}

/** Tell both sides the match reached its current state. Mirrors notify_match_state_change (0043). */
function notifyStatusChange(data: RepositoryData, match: Match): void {
  notifyMatchParties(data, match, {
    kind: "match_status",
    ...matchStatusMessage(match.state),
    dedupeKey: `status:${match.id}:${match.state}`
  });
}

function ngoForMatch(match: Match, data: RepositoryData): Ngo | undefined {
  const need = needForMatch(match, data);
  return need ? data.ngos.find((ngo) => ngo.id === need.ngoId) : undefined;
}

function companyForMatch(match: Match, data: RepositoryData): Company | undefined {
  const listing = listingForMatch(match, data);
  return listing ? data.companies.find((company) => company.id === listing.companyId) : undefined;
}

function needForMatch(match: Match, data: RepositoryData): Need | undefined {
  return data.needs.find((need) => need.id === match.needId);
}

function publicNgoProfile(ngo: Ngo): PublicNgoProfile {
  return {
    id: ngo.id,
    country: ngo.country,
    focus: ngo.focus,
    verificationState: ngo.verificationState,
    trustScore: ngo.trustScore
  };
}

function fullNgoProfile(ngo: Ngo): FullNgoProfile {
  return {
    ...publicNgoProfile(ngo),
    name: ngo.name,
    city: ngo.city,
    boardContact: ngo.boardContact,
    contactEmail: ngo.contactEmail,
    contactPhone: ngo.contactPhone,
    address: ngo.address,
    verifiedAt: ngo.verifiedAt
  };
}

function recordAudit(
  data: RepositoryData,
  actor: string,
  action: string,
  target: string,
  visibility: AuditEvent["visibility"]
): void {
  data.auditEvents.unshift({
    id: `aud-${data.auditEvents.length + 1}`,
    actor,
    action,
    target,
    visibility,
    createdAt: "2026-06-24T00:00:00.000Z"
  });
}

function normalizeOptionalDeliveryField(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function createDraftDocument(
  data: RepositoryData,
  actor: ActorContext,
  planDocument: AgentPlanDocument
): Document {
  const document: Document = {
    id: `doc-${data.documents.length + 1}`,
    kind: planDocument.kind,
    title: planDocument.title,
    status: planDocument.status,
    companyId: actor.role === "corporate" ? actor.companyId : null,
    ngoId: actor.role === "ngo" ? actor.ngoId : null,
    matchId: planDocument.matchId,
    storagePath: planDocument.storagePath,
    mime: planDocument.mime,
    sizeBytes: planDocument.sizeBytes,
    createdBy: actor.userId,
    createdAt: nowIso(),
    publishedAt: null
  };

  data.documents.push(document);
  return document;
}

function createProposedAction(
  runId: string,
  planAction: AgentPlanProposedAction,
  index: number,
  document: Document | null
): AgentProposedAction {
  return {
    id: `act-${runId}-${index + 1}`,
    runId,
    label: planAction.label,
    description: planAction.description,
    status: "pending",
    riskLevel: planAction.riskLevel,
    targetType: planAction.targetType,
    targetId: planAction.targetType === "document" && !planAction.targetId ? document?.id ?? null : planAction.targetId,
    proposedPayload: planAction.proposedPayload,
    requiresHumanApproval: true,
    approvedBy: null,
    approvedAt: null,
    executedAt: null
  };
}

function applyExecutedAction(action: AgentProposedAction, actor: ActorContext, data: RepositoryData): void {
  if (action.targetType === "message" && action.targetId) {
    const body = action.proposedPayload.body;
    if (typeof body !== "string" || !body.trim()) return;
    const match = data.matches.find((item) => item.id === action.targetId);
    if (!match || !canSeeMatch(match, actor, data)) return;

    appendMessage(data, {
      id: `msg-${action.id}`,
      matchId: action.targetId,
      authorId: actor.userId,
      body: body.trim(),
      visibility: "customer_visible"
    });
    return;
  }

  if (action.targetType === "listing" && !action.targetId) {
    if (actor.role !== "corporate" && !isOpsRole(actor.role)) return;
    const payload = action.proposedPayload;
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (!title) return;
    const companyId =
      actor.role === "corporate"
        ? actor.companyId
        : typeof payload.companyId === "string"
          ? payload.companyId
          : "";
    if (!companyId) return;
    const num = (value: unknown, fallback: number): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const str = (value: unknown, fallback = ""): string =>
      typeof value === "string" && value.trim() ? value.trim() : fallback;

    data.listings.push({
      id: `lst-${action.id}`,
      companyId,
      title,
      category: str(payload.category, "General"),
      subcategory: str(payload.subcategory) || null,
      quantity: Math.max(1, Math.round(num(payload.quantity, 1))),
      unit: str(payload.unit, "units"),
      unitValue: Math.max(0, num(payload.unitValue, 0)),
      city: str(payload.city),
      country: str(payload.country),
      condition: str(payload.condition, "Good"),
      state: "open",
      availableUntil: null,
      pickupWindow: "",
      packaging: "",
      weightKg: Math.max(0, num(payload.weightKg, 0)),
      categoryDetails: str(payload.categoryDetails) || "Imported via Copilot surplus intake.",
      photos: [],
      attachments: [],
      reviewFlags: [],
      eligibility: { usable: true, policyFit: true, ownership: true },
      createdAt: nowIso()
    });
    return;
  }

  if (action.targetType === "listing" && action.targetId) {
    const reviewFlag = action.proposedPayload.reviewFlag;
    const listing = data.listings.find((item) => item.id === action.targetId);
    const canChangeListing =
      isOpsRole(actor.role) || (actor.role === "corporate" && listing?.companyId === actor.companyId);
    if (listing && canChangeListing && typeof reviewFlag === "string" && reviewFlag && !listing.reviewFlags.includes(reviewFlag)) {
      listing.reviewFlags.push(reviewFlag);
    }
    return;
  }

  if (action.targetType === "document" && action.targetId) {
    const document = data.documents.find((item) => item.id === action.targetId);
    if (!document || !canSeeDocument(document, actor, data)) return;

    const status = action.proposedPayload.status;
    if (status === "approved" || status === "published") {
      document.status = status;
      if (status === "published") document.publishedAt = nowIso();
    }
  }
}

function appendMessage(
  data: RepositoryData,
  input: {
    id?: string;
    matchId: string;
    authorId: string | null;
    body: string;
    visibility: Visibility;
  }
): Message {
  const message: Message = {
    id: input.id ?? `msg-${data.messages.length + 1}`,
    matchId: input.matchId,
    authorId: input.authorId,
    body: input.body,
    visibility: input.visibility,
    createdAt: nowIso()
  };
  data.messages.push(message);
  return message;
}

function referentialIntegrityErrors(data: RepositoryData): string[] {
  const errors: string[] = [];
  const companyIds = new Set(data.companies.map((company) => company.id));
  const ngoIds = new Set(data.ngos.map((ngo) => ngo.id));
  const userIds = new Set(data.users.map((user) => user.id));
  const listingIds = new Set(data.listings.map((listing) => listing.id));
  const needIds = new Set(data.needs.map((need) => need.id));
  const matchIds = new Set(data.matches.map((match) => match.id));
  const documentIds = new Set(data.documents.map((document) => document.id));
  const agentRunIds = new Set(data.agentRuns.map((run) => run.id));
  const invitationIds = new Set(data.invitations.map((invitation) => invitation.id));

  data.users.forEach((user) => {
    if (user.role === "corporate" && (!user.companyId || !companyIds.has(user.companyId))) {
      errors.push(`user ${user.id} has invalid company`);
    }
    if (user.role === "ngo" && (!user.ngoId || !ngoIds.has(user.ngoId))) {
      errors.push(`user ${user.id} has invalid ngo`);
    }
    if (isOpsRole(user.role) && (user.companyId || user.ngoId)) {
      errors.push(`ops user ${user.id} must not be org-bound`);
    }
  });
  data.invitations.forEach((invitation) => {
    if (invitation.role === "corporate" && (!invitation.companyId || !companyIds.has(invitation.companyId) || invitation.ngoId)) {
      errors.push(`invitation ${invitation.id} has invalid company scope`);
    }
    if (invitation.role === "ngo" && (!invitation.ngoId || !ngoIds.has(invitation.ngoId) || invitation.companyId)) {
      errors.push(`invitation ${invitation.id} has invalid ngo scope`);
    }
    if (isOpsRole(invitation.role) && (invitation.companyId || invitation.ngoId)) {
      errors.push(`ops invitation ${invitation.id} must not be org-bound`);
    }
  });
  data.invitationDeliveryAttempts.forEach((attempt) => {
    if (!invitationIds.has(attempt.invitationId)) {
      errors.push(`invitation delivery ${attempt.id} has invalid invitation`);
    }
    if (attempt.actorId && !userIds.has(attempt.actorId)) {
      errors.push(`invitation delivery ${attempt.id} has invalid actor`);
    }
  });
  data.listings.forEach((listing) => {
    if (!companyIds.has(listing.companyId)) errors.push(`listing ${listing.id} has invalid company`);
  });
  const caseIds = new Set(data.donationCases.map((item) => item.id));
  data.donationCases.forEach((donationCase) => {
    if (!companyIds.has(donationCase.companyId)) {
      errors.push(`donation case ${donationCase.id} has invalid company`);
    }
    if (donationCase.step < 1 || donationCase.step > 7) {
      errors.push(`donation case ${donationCase.id} has invalid step`);
    }
  });
  data.donationPositions.forEach((position) => {
    if (!caseIds.has(position.caseId)) {
      errors.push(`donation position ${position.id} has invalid case`);
    }
  });
  const positionIds = new Set(data.donationPositions.map((item) => item.id));
  data.donationAllocations.forEach((allocation) => {
    if (!positionIds.has(allocation.positionId)) {
      errors.push(`donation allocation ${allocation.id} has invalid position`);
    }
    if (!caseIds.has(allocation.caseId)) {
      errors.push(`donation allocation ${allocation.id} has invalid case`);
    }
    if (!ngoIds.has(allocation.ngoId)) {
      errors.push(`donation allocation ${allocation.id} has invalid ngo`);
    }
  });
  data.needs.forEach((need) => {
    if (!ngoIds.has(need.ngoId)) errors.push(`need ${need.id} has invalid ngo`);
  });
  data.matches.forEach((match) => {
    if (!listingIds.has(match.listingId)) errors.push(`match ${match.id} has invalid listing`);
    if (!needIds.has(match.needId)) errors.push(`match ${match.id} has invalid need`);
  });
  data.messages.forEach((message) => {
    if (!matchIds.has(message.matchId)) errors.push(`message ${message.id} has invalid match`);
    if (message.authorId && !userIds.has(message.authorId)) errors.push(`message ${message.id} has invalid author`);
  });
  data.documents.forEach((document) => {
    if (document.companyId && !companyIds.has(document.companyId)) errors.push(`document ${document.id} has invalid company`);
    if (document.ngoId && !ngoIds.has(document.ngoId)) errors.push(`document ${document.id} has invalid ngo`);
    if (document.matchId && !matchIds.has(document.matchId)) errors.push(`document ${document.id} has invalid match`);
    if (document.createdBy && !userIds.has(document.createdBy)) errors.push(`document ${document.id} has invalid creator`);
    if (document.companyId && document.ngoId) errors.push(`document ${document.id} must not have two direct owners`);
  });
  data.agentRuns.forEach((run) => {
    if (run.companyId && !companyIds.has(run.companyId)) errors.push(`agent run ${run.id} has invalid company`);
    if (run.ngoId && !ngoIds.has(run.ngoId)) errors.push(`agent run ${run.id} has invalid ngo`);
    if (run.producedDocumentId && !documentIds.has(run.producedDocumentId)) {
      errors.push(`agent run ${run.id} has invalid produced document`);
    }
  });
  data.proposedActions.forEach((action) => {
    if (!agentRunIds.has(action.runId)) errors.push(`agent action ${action.id} has invalid run`);
    if (action.targetType === "document" && action.targetId && !documentIds.has(action.targetId)) {
      errors.push(`agent action ${action.id} has invalid document target`);
    }
    if (action.status === "executed" && (!action.approvedBy || !action.approvedAt)) {
      errors.push(`agent action ${action.id} executed without approval`);
    }
    if (action.approvedBy && !userIds.has(action.approvedBy)) {
      errors.push(`agent action ${action.id} has invalid approver`);
    }
  });
  return errors;
}

function cloneData(data: RepositoryData): RepositoryData {
  return structuredClone(data);
}

function canSeeAgentRun(run: AgentRun, actor: ActorContext): boolean {
  if (actor.role === "admin" || actor.role === "editor") return true;
  if (actor.role === "corporate") return run.companyId === actor.companyId;
  return run.ngoId === actor.ngoId;
}

function canApproveAgentRun(run: AgentRun, actor: ActorContext): boolean {
  return canSeeAgentRun(run, actor);
}

function syncAgentRunStatus(run: AgentRun, data: RepositoryData): void {
  const actions = data.proposedActions.filter((action) => action.runId === run.id);
  if (actions.length === 0) {
    run.status = "queued";
    return;
  }
  if (actions.every((action) => action.status === "executed")) {
    run.status = "completed";
    run.completedAt = nowIso();
    return;
  }
  if (actions.every((action) => action.status === "rejected")) {
    run.status = "rejected";
    return;
  }
  if (actions.some((action) => action.status === "pending")) {
    run.status = "needs_approval";
    return;
  }
  if (actions.every((action) => action.status === "approved" || action.status === "executed")) {
    run.status = "approved";
    return;
  }

  run.status = "completed";
}

function isNeedDeliveryPreference(value: string): value is NeedDeliveryPreference {
  return (NEED_DELIVERY_PREFERENCES as readonly string[]).includes(value);
}

function nowIso(): string {
  return "2026-06-24T00:00:00.000Z";
}

function resolveDonationCaseAccess(
  actor: ActorContext,
  caseId: string,
  data: RepositoryData
): { ok: true; donationCase: DonationCase } | { ok: false; reason: string } {
  if (actor.role !== "corporate" && !isOpsRole(actor.role)) {
    return { ok: false, reason: "actor_not_allowed" };
  }
  const donationCase = data.donationCases.find((item) => item.id === caseId);
  if (!donationCase) return { ok: false, reason: "case_not_found" };
  if (actor.role === "corporate" && donationCase.companyId !== actor.companyId) {
    return { ok: false, reason: "actor_not_allowed" };
  }
  if (!isCompanyVerified(data.companies.find((company) => company.id === donationCase.companyId))) {
    return { ok: false, reason: "company_not_verified" };
  }
  return { ok: true, donationCase };
}

function validateDonationPositionInput(
  input: DonationPositionCreateInput
): { ok: true; input: DonationPositionCreateInput } | { ok: false; reason: string } {
  if (!input.category.trim()) return { ok: false, reason: "invalid_category" };
  if (!input.model.trim()) return { ok: false, reason: "invalid_model" };
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, reason: "invalid_quantity" };
  }
  if (!input.condition.trim()) return { ok: false, reason: "invalid_condition" };
  if (!input.provenance.trim()) return { ok: false, reason: "invalid_provenance" };
  return {
    ok: true,
    input: {
      category: input.category.trim(),
      model: input.model.trim(),
      quantity: input.quantity,
      condition: input.condition.trim(),
      provenance: input.provenance.trim()
    }
  };
}

function pushDonationPosition(
  data: RepositoryData,
  donationCase: DonationCase,
  input: DonationPositionCreateInput
): DonationPosition {
  const position: DonationPosition = {
    id: `pos-${data.donationPositions.length + 1}`,
    caseId: donationCase.id,
    category: input.category,
    model: input.model,
    quantity: input.quantity,
    condition: input.condition,
    provenance: input.provenance,
    state: "ready",
    createdAt: nowIso()
  };
  data.donationPositions.push(position);
  return position;
}

function advanceCaseToInventory(donationCase: DonationCase): void {
  if (donationCase.step === 1) {
    donationCase.step = 2 as DonationCaseStep;
  }
}

/**
 * REQ-CORP-02 / ADR 0034: inventory change after confirm clears the gate and
 * returns confirmed/allocated positions to ready. Active allocations remain;
 * the reopen audit flags them until MATCH-09 callers refresh or release.
 */
function reopenDonationCaseConfirmation(
  data: RepositoryData,
  actorUserId: string,
  donationCase: DonationCase
): void {
  if (!donationCase.confirmedAt) return;

  donationCase.confirmedAt = null;
  donationCase.step = 2 as DonationCaseStep;
  for (const position of data.donationPositions) {
    if (
      position.caseId === donationCase.id &&
      (position.state === "confirmed" || position.state === "allocated")
    ) {
      position.state = "ready";
    }
  }
  recordAudit(
    data,
    actorUserId,
    "donation_case.confirmation_reopened",
    donationCase.id,
    "customer_visible"
  );
}

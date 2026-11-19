/**
 * `registered` is the state between signing up and paying. It is not the
 * landing page's "Pulse" tier — Pulse is sold as "Assessment only", a
 * calculator that never reaches a login.
 *
 * A registered corporate browses the needs directory anonymised: what is
 * needed, category, focus and country — never which organisation. Identity,
 * contact and matching are what Seed and Tree unlock (founder call
 * 2026-07-16; the named needs on the landing page are a curated showcase).
 */
export const PLAN_TIERS = ["registered", "seed", "tree"] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];

/** Paid tiers. Use this wherever a plan implies a customer, not a signup. */
export const PAID_PLAN_TIERS = ["seed", "tree"] as const;
export type PaidPlanTier = (typeof PAID_PLAN_TIERS)[number];

export function isPaidPlan(plan: PlanTier): plan is PaidPlanTier {
  return plan !== "registered";
}

export type PlanEntitlement = {
  platformAccess: true;
  matchesPerYear: number | null;
  userSeats: number;
  supportLevel: "none" | "48h" | "priority";
  csrdLevel: "none" | "per_match" | "audit_grade_isae3000";
  greenProcurementCertificate: boolean;
  socialMediaCards: boolean;
  employerBranding: boolean;
  matchingMode: "none" | "human" | "curated_priority";
  /**
   * Whether this tier may see who is behind a need and reach them — name,
   * email, phone, board contact, address. False for `registered`: it browses
   * the anonymised directory only. Enforced in the database
   * (open_needs_directory's column list + ngos_corporate_after_match),
   * mirrored here so the UI can branch without a round trip.
   */
  ngoContactAccess: boolean;
};

export const PLAN_ENTITLEMENTS = {
  registered: {
    // Can log in and browse — that is the point of registering. Cannot reach
    // an NGO, cannot match, gets no documentation.
    platformAccess: true,
    matchesPerYear: 0,
    userSeats: 1,
    supportLevel: "none",
    csrdLevel: "none",
    greenProcurementCertificate: false,
    socialMediaCards: false,
    employerBranding: false,
    matchingMode: "none",
    ngoContactAccess: false
  },
  seed: {
    platformAccess: true,
    matchesPerYear: 12,
    userSeats: 2,
    supportLevel: "48h",
    csrdLevel: "per_match",
    greenProcurementCertificate: false,
    socialMediaCards: false,
    employerBranding: false,
    matchingMode: "human",
    ngoContactAccess: true
  },
  tree: {
    platformAccess: true,
    matchesPerYear: null,
    userSeats: 5,
    supportLevel: "priority",
    csrdLevel: "audit_grade_isae3000",
    greenProcurementCertificate: true,
    socialMediaCards: true,
    employerBranding: true,
    matchingMode: "curated_priority",
    ngoContactAccess: true
  }
} as const satisfies Record<PlanTier, PlanEntitlement>;

/** Plan-gated features that have behaviour behind them today. Each is enforced in the database too. */
export const PLAN_GATED_FEATURES = ["social_media_cards"] as const;
export type PlanGatedFeature = (typeof PLAN_GATED_FEATURES)[number];

/**
 * Whether a plan includes a gated feature. The screens use this to hide what
 * the server would refuse (plan_required), so the two cannot drift apart.
 */
export function planAllows(plan: PlanTier, feature: PlanGatedFeature): boolean {
  switch (feature) {
    case "social_media_cards":
      return PLAN_ENTITLEMENTS[plan].socialMediaCards;
  }
}

/**
 * One row of the browsable needs directory, anonymised (founder call,
 * 2026-07-16): the need plus the posting NGO's focus and country — never a
 * name, city or contact. The ten names on the landing page are a curated
 * marketing showcase; inside the product, identity is part of what a paid
 * plan unlocks.
 */
export type OpenNeedRow = {
  needId: string;
  title: string;
  category: string;
  quantity: number | null;
  quantityOpen: boolean;
  urgency: NeedUrgency;
  country: string | null;
  ngoFocus: string | null;
  ngoCountry: string | null;
  /** How much of the need is still uncovered by live matches; null when the need names no quantity. */
  quantityRemaining: number | null;
  /** Non-contact logistics hints for matching (ADR 0035). Address / vehicle stay off this row. */
  deliveryPreference: NeedDeliveryPreference;
  maxQuantityPerMatch: number | null;
  targetGroup: string;
};

export const USER_ROLES = ["corporate", "ngo", "admin", "editor"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "expired", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const INVITATION_DELIVERY_OPERATIONS = ["create", "resend"] as const;
export type InvitationDeliveryOperation = (typeof INVITATION_DELIVERY_OPERATIONS)[number];

export const INVITATION_DELIVERY_STATUSES = ["sent", "skipped", "failed"] as const;
export type InvitationDeliveryStatus = (typeof INVITATION_DELIVERY_STATUSES)[number];

export const IDEMPOTENCY_STATUSES = ["processing", "completed", "failed"] as const;
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

export const ORG_STATUSES = ["onboarding", "active", "suspended"] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const NGO_VERIFICATION_STATES = [
  "onboarding",
  "verification_pending",
  "pending_info",
  "review",
  "verified",
  "rejected"
] as const;
export type NgoVerificationState = (typeof NGO_VERIFICATION_STATES)[number];

// Recipient organization type (ADR 0030). Drives which eligibility proof the
// verification flow requires — see NGO_PROOF_KIND_BY_ORG_TYPE.
export const NGO_ORG_TYPES = [
  "verein",
  "ggmbh",
  "stiftung",
  "public_body",
  "freier_traeger"
] as const;
export type NgoOrgType = (typeof NGO_ORG_TYPES)[number];

export const NGO_PROOF_KINDS = [
  "freistellungsbescheid",
  "public_law_proof",
  "traeger_proof"
] as const;
export type NgoProofKind = (typeof NGO_PROOF_KINDS)[number];

/** Mirror of the SQL required_proof_kind(org_type) (migration 0024, ADR 0030). */
export const NGO_PROOF_KIND_BY_ORG_TYPE: Record<NgoOrgType, NgoProofKind> = {
  verein: "freistellungsbescheid",
  ggmbh: "freistellungsbescheid",
  stiftung: "freistellungsbescheid",
  public_body: "public_law_proof",
  freier_traeger: "traeger_proof"
};

export const LISTING_STATES = [
  "draft",
  "open",
  "match_pending",
  "confirmed",
  "completed",
  "withdrawn"
] as const;
export type ListingState = (typeof LISTING_STATES)[number];

/** `draft` = saved by an unverified NGO; not in the directory / not allocatable. */
export const NEED_STATES = ["draft", "open", "matched", "fulfilled", "closed"] as const;
export type NeedState = (typeof NEED_STATES)[number];

/**
 * How an NGO actually expresses timing. Checked against the eight real Tally
 * submissions: none gave a date, all gave one of these.
 *   asap     — "As soon as possible"
 *   flexible — "nicht sehr dringend", "as available", "Wann immer möglich"
 *   by_date  — "1 September 2026", "10/2026 - 02/2027"
 *   ongoing  — "permanent" (Labdoo)
 */
export const NEED_URGENCIES = ["asap", "flexible", "by_date", "ongoing"] as const;
export type NeedUrgency = (typeof NEED_URGENCIES)[number];

/**
 * How the NGO prefers goods to arrive (REQ-NGO-05 / ADR 0035).
 *   collect — NGO collects from the corporate site
 *   ship    — corporate (or courier) ships to the NGO delivery address
 *   either  — Ops may choose either mode when allocating
 */
export const NEED_DELIVERY_PREFERENCES = ["collect", "ship", "either"] as const;
export type NeedDeliveryPreference = (typeof NEED_DELIVERY_PREFERENCES)[number];

export const MATCH_STATES = [
  "proposed",
  "ngo_confirmed",
  "both_confirmed",
  "in_transit",
  "delivered",
  "completed",
  "cancelled",
  "expired",
  "failed"
] as const;
export type MatchState = (typeof MATCH_STATES)[number];

/** States a match never leaves (ADR 0028 D2/D4/D5). */
export const MATCH_TERMINAL_STATES = [
  "completed",
  "cancelled",
  "expired",
  "failed"
] as const satisfies readonly MatchState[];

/**
 * Cancelled and failed are different endings (ADR 0028 D4): a match withdrawn
 * before shipping is cancelled; one that collapses once the goods are on their
 * way has failed. Ops can only cancel from these...
 */
export const MATCH_CANCELLABLE_STATES = [
  "proposed",
  "ngo_confirmed",
  "both_confirmed"
] as const satisfies readonly MatchState[];

/** ...and can only fail a match from these. */
export const MATCH_FAILABLE_STATES = ["in_transit", "delivered"] as const satisfies readonly MatchState[];

/**
 * A `proposed` match nobody reacted to for this long expires on its own, and
 * consumes no quota (ADR 0028 D5). Mirrored in expire_stale_proposals (0035).
 */
export const PROPOSAL_EXPIRY_DAYS = 14;

/** Both sides get a reminder this many days before a proposal expires. Mirrored in warn_expiring_proposals (0042). */
export const PROPOSAL_EXPIRY_WARNING_DAYS = 3;

/**
 * NGO + Ops get a reminder this many days before a tax-exemption proof expires
 * (REQ-NGO-06). Mirrored in warn_expiring_ngo_proofs (0068).
 */
export const NGO_PROOF_REMINDER_DAYS = 60;

/** Common AO assessment-period defaults Ops can pick (tax advisor may refine). */
export const NGO_PROOF_ASSESSMENT_PERIOD_YEARS_OPTIONS = [3, 5] as const;

/**
 * Public-law bodies have no Freistellungsbescheid notice (ADR 0030 / REQ-NGO-06).
 * All other org types store notice date + assessment period and derive validity.
 */
export function ngoRequiresProofExpiry(orgType: NgoOrgType | null | undefined): boolean {
  return orgType != null && orgType !== "public_body";
}

/** Derive proof_valid_until = notice_date + assessment_period_years (calendar). */
export function deriveProofValidUntil(noticeDate: string, assessmentPeriodYears: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(noticeDate.trim());
  if (!match) {
    throw new Error("invalid_proof_notice_date");
  }
  if (!Number.isInteger(assessmentPeriodYears) || assessmentPeriodYears < 1 || assessmentPeriodYears > 20) {
    throw new Error("invalid_proof_assessment_period");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year + assessmentPeriodYears, month - 1, day));
  return utc.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return utc.toISOString().slice(0, 10);
}

/** What both sides are told when a match reaches a state. Mirrored in notify_match_state_change (0043). */
export function matchStatusMessage(state: MatchState): { title: string; body: string } {
  switch (state) {
    case "proposed":
      return { title: "A match was proposed", body: "Ops proposed a match. Open it to review and confirm." };
    case "ngo_confirmed":
      return { title: "The NGO confirmed the match", body: "The NGO confirmed the fit. The company confirms next." };
    case "both_confirmed":
      return { title: "Both sides confirmed", body: "The match is confirmed and contact details are unlocked." };
    case "in_transit":
      return { title: "The goods are on their way", body: "Pickup is done and delivery is under way." };
    case "delivered":
      return { title: "The goods were delivered", body: "Delivery is recorded. The NGO confirms receipt next." };
    case "completed":
      return { title: "The match is complete", body: "Receipt is confirmed and the documents are ready." };
    case "cancelled":
      return { title: "The match was cancelled", body: "This match was withdrawn before shipping." };
    case "expired":
      return { title: "The proposal expired", body: "Nobody confirmed it in time, so it lapsed. No quota was used." };
    case "failed":
      return { title: "Delivery failed", body: "Delivery did not work out after shipping. Ops reviews what happened." };
  }
}

export const NOTIFICATION_KINDS = [
  "proposal_expiring",
  "match_status",
  "ngo_proof_expiring",
  "ngo_proof_expired"
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** An in-app message for one user about one match. */
export type Notification = {
  id: string;
  userId: string;
  matchId: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  /** One notification per user and key, so a job that runs twice never repeats itself. */
  dedupeKey: string;
  createdAt: string;
};

export const CONTACT_UNLOCK_STATES = [
  "both_confirmed",
  "in_transit",
  "delivered",
  "completed"
] as const satisfies readonly MatchState[];

export const MATCH_COMMITTED_STATES = CONTACT_UNLOCK_STATES;

export const CERTIFICATE_STATUSES = ["none", "draft", "issued", "final"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const VISIBILITIES = ["admin_only", "customer_visible"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const DOCUMENT_KINDS = [
  "upload",
  "marketing_asset",
  "social_ad",
  "certificate",
  "agreement",
  "report"
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "published",
  "archived"
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const ENVELOPE_STATES = [
  "draft",
  "sent",
  "partially_signed",
  "completed",
  "declined",
  "voided"
] as const;
export type EnvelopeState = (typeof ENVELOPE_STATES)[number];

export const AGENT_RUN_STATUSES = [
  "queued",
  "needs_approval",
  "approved",
  "completed",
  "rejected"
] as const;
export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const PROPOSED_ACTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "executed"
] as const;
export type ProposedActionStatus = (typeof PROPOSED_ACTION_STATUSES)[number];

export const LOOP_RISK_LEVELS = ["low", "medium", "high"] as const;
export type LoopRiskLevel = (typeof LOOP_RISK_LEVELS)[number];

export type AgentFinding = {
  label: string;
  detail: string;
  severity: "info" | "warning" | "risk";
};

export type AgentAttachment = {
  name: string;
  mime: string;
  sizeBytes: number;
};

// Corporate trust state (ADR 0027 C1). Same shape as the NGO states; a company
// is verified by Ops after reviewing its business proof.
export const COMPANY_VERIFICATION_STATES = [
  "onboarding",
  "verification_pending",
  "pending_info",
  "review",
  "verified",
  "rejected"
] as const;
export type CompanyVerificationState = (typeof COMPANY_VERIFICATION_STATES)[number];

export type Company = {
  id: string;
  name: string;
  plan: PlanTier;
  status: OrgStatus;
  /** Corporate trust state (ADR 0027 C1); independent of status/plan. */
  verificationState?: CompanyVerificationState;
  verifiedAt?: string | null;
  /** Given for the automatic company check (ADR 0027 C3). */
  vatId?: string | null;
  website?: string | null;
  city: string;
  country: string;
  ownerName: string;
  contactEmail: string;
  reportingEmail: string;
  createdAt: string;
};

/**
 * Verified by Ops (ADR 0027). Matching, NGO contact details and documents need
 * this, whatever the plan; browsing does not. Mirrors company_is_verified().
 */
export function isCompanyVerified(company: Pick<Company, "verificationState"> | undefined): boolean {
  return company?.verificationState === "verified";
}

/**
 * Mirrors ngo_is_verified(). Verified means Ops approved and (for notice-based
 * org types) the derived proof has not yet expired (REQ-NGO-06).
 */
export function isNgoVerified(
  ngo: Pick<Ngo, "verificationState" | "orgType" | "proofValidUntil"> | undefined,
  now: string = new Date().toISOString()
): boolean {
  if (ngo?.verificationState !== "verified") return false;
  if (!ngoRequiresProofExpiry(ngo.orgType)) return true;
  if (!ngo.proofValidUntil) return true; // grandfathered / not yet recorded
  return ngo.proofValidUntil >= now.slice(0, 10);
}

/** True when a verified, notice-based NGO is inside the 60-day reminder window. */
export function isNgoProofExpiringSoon(
  ngo: Pick<Ngo, "verificationState" | "orgType" | "proofValidUntil">,
  now: string = new Date().toISOString()
): boolean {
  if (ngo.verificationState !== "verified") return false;
  if (!ngoRequiresProofExpiry(ngo.orgType) || !ngo.proofValidUntil) return false;
  const today = now.slice(0, 10);
  if (ngo.proofValidUntil < today) return false;
  const remindFrom = addUtcDays(ngo.proofValidUntil, -NGO_PROOF_REMINDER_DAYS);
  return today >= remindFrom;
}

export const RECIPIENT_STATUSES = ["pending", "viewed", "signed", "declined"] as const;
export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

/** One signer of an envelope: the company or the NGO. */
export type EnvelopeRecipient = {
  partyName: string;
  partyEmail: string;
  status: RecipientStatus;
  signedAt: string | null;
};

/**
 * A donation document sent for e-signature through DocuSeal. Its state changes
 * only through DocuSeal's webhook (invariant 5), never from a user session.
 */
export type SignatureEnvelope = {
  id: string;
  documentId: string;
  externalId: string;
  state: EnvelopeState;
  recipients: EnvelopeRecipient[];
  /** Private storage path of the signed PDF once DocuSeal reported completion. */
  signedStoragePath: string | null;
  createdAt: string;
  completedAt: string | null;
};

/**
 * One maintained CO2 factor per goods category: kg CO2e avoided per kg of goods
 * (ADR 0028 D6). Edited by Ops only; every change is audited.
 */
export type Co2Factor = {
  category: string;
  kgCo2ePerKg: number;
  updatedAt: string;
};

/** The upper bound the database enforces on a factor (kg CO2e per kg). */
export const CO2_FACTOR_MAX = 1000;

/** The result of one automatic company check. Ops reads these in the risk queue. */
export type CompanyCheck = {
  id: string;
  companyId: string;
  vatOk: boolean;
  vatName: string | null;
  domainOk: boolean;
  websiteOk: boolean;
  outcome: "approved" | "manual_review";
  createdAt: string;
};

export type Ngo = {
  id: string;
  name: string;
  city: string;
  country: string;
  focus: string;
  verificationState: NgoVerificationState;
  trustScore: number;
  boardContact: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  verifiedAt: string | null;
  /** Recipient organization type (ADR 0030); drives the required proof kind. */
  orgType?: NgoOrgType | null;
  /** A1 · authorisation data for a legally complete Zuwendungsbestätigung. */
  taxAuthorizationRef?: string | null;
  taxAuthorizationDate?: string | null;
  taxOffice?: string | null;
  registryNumber?: string | null;
  authorizedSigner?: string | null;
  authorizedSignerRole?: string | null;
  /**
   * REQ-NGO-06 · tax-exemption notice date (Bescheiddatum). Mandatory on Ops
   * approve for notice-based org types; null for public_body.
   */
  proofNoticeDate?: string | null;
  /** Assessment period in years; validity = notice date + this many years. */
  proofAssessmentPeriodYears?: number | null;
  /** Derived from notice date + assessment period; never set as a free-floating date. */
  proofValidUntil?: string | null;
  /** When the 60-day reminder was sent (null until warned). */
  proofExpiryRemindedAt?: string | null;
  createdAt: string;
};

export type User = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId: string | null;
  ngoId: string | null;
  createdAt: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  ngoId: string | null;
  orgName: string | null;
  status: InvitationStatus;
  expiresAt: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdAt: string;
};

/** Who may ask for access without an invite (REQ-AUTH-05). */
export const ACCESS_REQUEST_ROLES = ["corporate", "ngo"] as const;
export type AccessRequestRole = (typeof ACCESS_REQUEST_ROLES)[number];
export type AccessRequestStatus = "new" | "invited" | "declined";

/** A lead from the public "Request access" form. Visible to Ops only. */
export type AccessRequest = {
  id: string;
  name: string;
  organization: string;
  role: AccessRequestRole;
  email: string;
  phone: string | null;
  message: string | null;
  status: AccessRequestStatus;
  createdAt: string;
};

export type InvitationDeliveryAttempt = {
  id: string;
  invitationId: string;
  operation: InvitationDeliveryOperation;
  provider: string;
  status: InvitationDeliveryStatus;
  messageId: string | null;
  error: string | null;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
};

export type IdempotencyRecord = {
  id: string;
  key: string;
  actorId: string;
  endpointId: string;
  requestHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
};

export type Listing = {
  id: string;
  companyId: string;
  title: string;
  category: string;
  subcategory: string | null;
  quantity: number;
  unit: string;
  unitValue: number;
  city: string;
  country: string;
  condition: string;
  state: ListingState;
  availableUntil: string | null;
  pickupWindow: string;
  packaging: string;
  weightKg: number;
  categoryDetails: string;
  photos: string[];
  attachments: string[];
  reviewFlags: string[];
  eligibility: {
    usable: boolean;
    policyFit: boolean;
    ownership: boolean;
  };
  createdAt: string;
};

export type Need = {
  id: string;
  ngoId: string;
  title: string;
  category: string;
  /** The catalog subcategory id (analogous to Listing.subcategory). Null for
   *  needs posted before the two-level catalog / mandatory subcategory. */
  subcategory: string | null;
  /** Null is a legitimate answer: "Laptops", "as many as you have". */
  quantity: number | null;
  /** The NGO said any amount / an ongoing need, rather than leaving it blank. */
  quantityOpen: boolean;
  urgency: NeedUrgency;
  city: string;
  country: string;
  /** Only meaningful when urgency is by_date. */
  targetDate: string | null;
  beneficiaries: number;
  /**
   * Delivery preference for this need (REQ-NGO-05). Independent of MATCH-10's
   * eventual per-allocation delivery mode.
   */
  deliveryPreference: NeedDeliveryPreference;
  /**
   * Cap on quantity for any single match/allocation. Null = no per-match cap
   * beyond the need's open remainder.
   */
  maxQuantityPerMatch: number | null;
  /** Who the goods serve — free text Ops uses when allocating without calling back. */
  targetGroup: string;
  /**
   * Street / building line for handover. May differ from the NGO's registered
   * `address`; city/country on this need are the delivery locality.
   */
  deliveryAddress: string;
  /** NGO can collect with its own vehicle when preference is collect/either. */
  hasVehicle: boolean;
  state: NeedState;
  story: string;
  createdAt: string;
};

/**
 * Phase 1 donation workflow steps (REQ-CORP-01 / ADR 0033). Maps the exit
 * criteria: contact → inventory → confirm → allocation → handover → paperwork → report.
 */
export const DONATION_CASE_STEPS = [1, 2, 3, 4, 5, 6, 7] as const;
export type DonationCaseStep = (typeof DONATION_CASE_STEPS)[number];

export const DONATION_CASE_STEP_KEYS = [
  "contact",
  "inventory",
  "confirm",
  "allocation",
  "handover",
  "paperwork",
  "report"
] as const;
export type DonationCaseStepKey = (typeof DONATION_CASE_STEP_KEYS)[number];

export const DONATION_CASE_STEP_BY_NUMBER: Record<DonationCaseStep, DonationCaseStepKey> = {
  1: "contact",
  2: "inventory",
  3: "confirm",
  4: "allocation",
  5: "handover",
  6: "paperwork",
  7: "report"
};

/** Position lifecycle inside a case. `allocated` is set while active MATCH-09 claims exist. */
export const DONATION_POSITION_STATES = [
  "draft",
  "ready",
  "confirmed",
  "allocated",
  "delivered",
  "completed",
  "released"
] as const;
export type DonationPositionState = (typeof DONATION_POSITION_STATES)[number];

/** One donation case: contact, location, time window, and a 1–7 step cursor. */
export type DonationCase = {
  id: string;
  companyId: string;
  title: string;
  step: DonationCaseStep;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  city: string;
  country: string;
  locationNotes: string | null;
  timeWindow: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  /** Set by REQ-CORP-02 confirm; null until then (or after reopen). */
  confirmedAt: string | null;
  createdAt: string;
};

/** True once the company has confirmed inventory (ADR 0034). */
export function donationCaseIsConfirmed(donationCase: Pick<DonationCase, "confirmedAt">): boolean {
  return donationCase.confirmedAt !== null;
}

/**
 * Gate for MATCH-09 allocation: Ops may see positions earlier, but must not
 * allocate until confirm. Returns a stable reason for routes/RPCs.
 */
export function assertDonationCaseAllocatable(
  donationCase: Pick<DonationCase, "confirmedAt"> | null | undefined
): { ok: true } | { ok: false; reason: "case_not_found" | "case_not_confirmed" } {
  if (!donationCase) return { ok: false, reason: "case_not_found" };
  if (!donationCaseIsConfirmed(donationCase)) {
    return { ok: false, reason: "case_not_confirmed" };
  }
  return { ok: true };
}

/** One line item on a donation case. */
export type DonationPosition = {
  id: string;
  caseId: string;
  category: string;
  model: string;
  quantity: number;
  condition: string;
  provenance: string;
  state: DonationPositionState;
  createdAt: string;
};

/**
 * Allocation lifecycle (REQ-MATCH-09). Active rows hold quantity against a
 * position; released returns that quantity to the pool. MATCH-10 may add
 * delivery records without inventing a second allocation state machine.
 */
export const DONATION_ALLOCATION_STATES = ["active", "released"] as const;
export type DonationAllocationState = (typeof DONATION_ALLOCATION_STATES)[number];

/** One allocation: position + NGO + quantity + status (ADR 0037). */
export type DonationAllocation = {
  id: string;
  positionId: string;
  caseId: string;
  ngoId: string;
  quantity: number;
  state: DonationAllocationState;
  /**
   * Label snapshot taken at create (0071): the NGO reads its allocations but
   * not positions/cases (RLS — the case row holds company contact data).
   */
  positionModel: string;
  caseTitle: string;
  /** Written release note; set when state becomes released. */
  releaseNote: string | null;
  releasedAt: string | null;
  createdAt: string;
};

/** Sum of active (non-released) allocated quantity for a position. */
export function activeAllocatedQuantity(
  allocations: ReadonlyArray<Pick<DonationAllocation, "positionId" | "quantity" | "state">>,
  positionId: string
): number {
  return allocations
    .filter((item) => item.positionId === positionId && item.state === "active")
    .reduce((sum, item) => sum + item.quantity, 0);
}

export type Match = {
  id: string;
  listingId: string;
  needId: string;
  state: MatchState;
  /** The part of the need this match covers (ADR 0028 D3). */
  quantity: number;
  /**
   * When it took one unit of the company's contract-year quota: at both_confirmed
   * (ADR 0026), and it stays taken if the match is cancelled. Null before that.
   */
  committedAt: string | null;
  /** Set when the unit was given back: failed through no fault of the NGO (ADR 0028 D4). */
  quotaRefundedAt: string | null;
  score: number;
  co2Tons: number;
  pickupDate: string | null;
  deliveryDate: string | null;
  carrier: string | null;
  trackingRef: string | null;
  createdAt: string;
};

export type Message = {
  id: string;
  matchId: string;
  authorId: string | null;
  body: string;
  visibility: Visibility;
  createdAt: string;
};

export type Document = {
  id: string;
  kind: DocumentKind;
  title: string;
  status: DocumentStatus;
  companyId: string | null;
  ngoId: string | null;
  matchId: string | null;
  storagePath: string | null;
  mime: string | null;
  sizeBytes: number | null;
  createdBy: string | null;
  createdAt: string;
  publishedAt: string | null;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  visibility: Visibility;
  createdAt: string;
};

/** One invocation of a timed job (REQ-OPS-13 / ADR 0031). */
export const SCHEDULER_JOB_STATUSES = ["running", "ok", "failed"] as const;
export type SchedulerJobStatus = (typeof SCHEDULER_JOB_STATUSES)[number];

export type SchedulerJobRun = {
  id: string;
  jobName: string;
  startedAt: string;
  finishedAt: string | null;
  recordsProcessed: number | null;
  status: SchedulerJobStatus;
  errorText: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  createdAt: string;
};

export type AgentRun = {
  id: string;
  role: UserRole;
  companyId: string | null;
  ngoId: string | null;
  taskType: string;
  title: string;
  prompt: string;
  status: AgentRunStatus;
  summary: string;
  findings: AgentFinding[];
  attachments: AgentAttachment[];
  producedDocumentId: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type AgentProposedAction = {
  id: string;
  runId: string;
  label: string;
  description: string;
  status: ProposedActionStatus;
  riskLevel: LoopRiskLevel;
  targetType: string | null;
  targetId: string | null;
  proposedPayload: Record<string, unknown>;
  requiresHumanApproval: true;
  approvedBy: string | null;
  approvedAt: string | null;
  executedAt: string | null;
};

export type DonationCertificate = {
  id: string;
  matchId: string;
  status: CertificateStatus;
  fairValue: number | null;
  issuedAt: string | null;
  pdfPath: string | null;
};

export type PublicNgoProfile = Pick<
  Ngo,
  "id" | "country" | "focus" | "verificationState" | "trustScore"
>;

export type FullNgoProfile = PublicNgoProfile &
  Pick<
    Ngo,
    | "name"
    | "city"
    | "boardContact"
    | "contactEmail"
    | "contactPhone"
    | "address"
    | "verifiedAt"
  >;

export function unlocksContact(state: MatchState): boolean {
  return CONTACT_UNLOCK_STATES.includes(
    state as (typeof CONTACT_UNLOCK_STATES)[number]
  );
}

/**
 * States in which a match holds its part of the need. A proposal already does,
 * so Ops cannot over-book; cancelled and expired matches let go.
 */
export const QUANTITY_HOLDING_MATCH_STATES = [
  "proposed",
  "ngo_confirmed",
  "both_confirmed",
  "in_transit",
  "delivered",
  "completed"
] as const satisfies readonly MatchState[];

/**
 * How much of a need is still uncovered, or null for a need that names no
 * quantity ("as many as you have"). Mirrors need_open_quantity() (0039).
 */
export function needOpenQuantity(
  need: Pick<Need, "id" | "quantity">,
  matches: ReadonlyArray<Pick<Match, "needId" | "state" | "quantity">>
): number | null {
  if (!need.quantity) return null;

  const held = matches
    .filter(
      (match) =>
        match.needId === need.id &&
        (QUANTITY_HOLDING_MATCH_STATES as readonly string[]).includes(match.state)
    )
    .reduce((sum, match) => sum + match.quantity, 0);

  return Math.max(0, need.quantity - held);
}

/**
 * How a need's quantity reads wherever it appears. "Any quantity" is a choice
 * the NGO made, not a missing value; a still-open remainder shows when parts
 * of the need are already taken (ADR 0028 D3).
 */
export function needQuantityLabel(
  need: Pick<Need, "quantity" | "quantityOpen">,
  open: number | null = null
): string {
  if (need.quantityOpen) return "Any quantity";
  if (!need.quantity) return "Quantity not stated";
  const units = `${need.quantity} units`;

  return open !== null && open < need.quantity ? `${units} (${open} still open)` : units;
}

export function isTerminalMatchState(state: MatchState): boolean {
  return MATCH_TERMINAL_STATES.includes(state as (typeof MATCH_TERMINAL_STATES)[number]);
}

/** Whether a match currently holds one unit of its company's quota. Mirrors the quota count in transition_match. */
export function holdsQuota(match: Pick<Match, "committedAt" | "quotaRefundedAt">): boolean {
  return match.committedAt !== null && match.quotaRefundedAt === null;
}

export function isCommittedMatchState(state: MatchState): boolean {
  return MATCH_COMMITTED_STATES.includes(
    state as (typeof MATCH_COMMITTED_STATES)[number]
  );
}

import type {
  AgentRunStatus,
  CertificateStatus,
  CompanyVerificationState,
  DocumentKind,
  DocumentStatus,
  EnvelopeState,
  IdempotencyStatus,
  InvitationDeliveryOperation,
  InvitationDeliveryStatus,
  InvitationStatus,
  DonationAllocationState,
  DonationCaseStep,
  DonationPositionState,
  ListingState,
  LoopRiskLevel,
  MatchState,
  NeedDeliveryPreference,
  NeedState,
  NeedUrgency,
  NgoOrgType,
  NgoVerificationState,
  OrgStatus,
  PlanTier,
  ProposedActionStatus,
  UserRole,
  Visibility
} from "./model";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: CompanyRow;
        Insert: CompanyInsert;
        Update: Partial<CompanyInsert>;
      };
      ngos: {
        Row: NgoRow;
        Insert: NgoInsert;
        Update: Partial<NgoInsert>;
      };
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: Partial<UserInsert>;
      };
      invitations: {
        Row: InvitationRow;
        Insert: InvitationInsert;
        Update: Partial<InvitationInsert>;
      };
      invitation_delivery_attempts: {
        Row: InvitationDeliveryAttemptRow;
        Insert: InvitationDeliveryAttemptInsert;
        Update: Partial<InvitationDeliveryAttemptInsert>;
      };
      idempotency_keys: {
        Row: IdempotencyKeyRow;
        Insert: IdempotencyKeyInsert;
        Update: Partial<IdempotencyKeyInsert>;
      };
      listings: {
        Row: ListingRow;
        Insert: ListingInsert;
        Update: Partial<ListingInsert>;
      };
      donation_cases: {
        Row: DonationCaseRow;
        Insert: DonationCaseInsert;
        Update: Partial<DonationCaseInsert>;
      };
      donation_positions: {
        Row: DonationPositionRow;
        Insert: DonationPositionInsert;
        Update: Partial<DonationPositionInsert>;
      };
      donation_allocations: {
        Row: DonationAllocationRow;
        Insert: DonationAllocationInsert;
        Update: Partial<DonationAllocationInsert>;
      };
      needs: {
        Row: NeedRow;
        Insert: NeedInsert;
        Update: Partial<NeedInsert>;
      };
      matches: {
        Row: MatchRow;
        Insert: MatchInsert;
        Update: Partial<MatchInsert>;
      };
      access_requests: {
        Row: AccessRequestRow;
        Insert: Omit<AccessRequestRow, "id" | "created_at"> & Partial<Pick<AccessRequestRow, "id" | "created_at">>;
        Update: Partial<Omit<AccessRequestRow, "id" | "created_at">>;
      };
      messages: {
        Row: MessageRow;
        Insert: MessageInsert;
        Update: Partial<MessageInsert>;
      };
      audit_events: {
        Row: AuditEventRow;
        Insert: AuditEventInsert;
        Update: Partial<AuditEventInsert>;
      };
      agent_runs: {
        Row: AgentRunRow;
        Insert: AgentRunInsert;
        Update: Partial<AgentRunInsert>;
      };
      agent_proposed_actions: {
        Row: AgentProposedActionRow;
        Insert: AgentProposedActionInsert;
        Update: Partial<AgentProposedActionInsert>;
      };
      scheduler_job_runs: {
        Row: SchedulerJobRunRow;
        Insert: SchedulerJobRunInsert;
        Update: Partial<SchedulerJobRunInsert>;
      };
      donation_certificates: {
        Row: DonationCertificateRow;
        Insert: DonationCertificateInsert;
        Update: Partial<DonationCertificateInsert>;
      };
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: Partial<DocumentInsert>;
      };
      signature_envelopes: {
        Row: SignatureEnvelopeRow;
        Insert: SignatureEnvelopeInsert;
        Update: Partial<SignatureEnvelopeInsert>;
      };
      plan_entitlements: {
        Row: PlanEntitlementRow;
        Insert: PlanEntitlementRow;
        Update: Partial<PlanEntitlementRow>;
      };
    };
    Views: {
      // ngo_public_min was dropped in 0015. The registered tier reads
      // open_needs_directory() instead (0021): the need plus the posting NGO's
      // focus and country, anonymised — never a name or contact column.
      company_match_usage: {
        Row: {
          company_id: string;
          year: number;
          matches_committed: number;
        };
      };
    };
    Enums: {
      user_role: UserRole;
      org_status: OrgStatus;
      ngo_verification: NgoVerificationState;
      listing_state: ListingState;
      need_state: NeedState;
      match_state: MatchState;
      certificate_status: CertificateStatus;
      visibility: Visibility;
      document_kind: DocumentKind;
      document_status: DocumentStatus;
      envelope_state: EnvelopeState;
      plan_tier: PlanTier;
      invitation_status: InvitationStatus;
      invitation_delivery_operation: InvitationDeliveryOperation;
      invitation_delivery_status: InvitationDeliveryStatus;
      idempotency_status: IdempotencyStatus;
      agent_run_status: AgentRunStatus;
      proposed_action_status: ProposedActionStatus;
    };
    Functions: {
      reserve_idempotency_key: {
        Args: {
          p_key: string;
          p_endpoint_id: string;
          p_request_hash: string;
        };
        Returns: Array<{
          reservation_state: "reserved" | "replay" | "processing" | "failed" | "conflict";
          response_status: number | null;
          response_body: Json;
          resource_type: string | null;
          resource_id: string | null;
        }>;
      };
      complete_idempotency_key: {
        Args: {
          p_key: string;
          p_endpoint_id: string;
          p_request_hash: string;
          p_response_status: number;
          p_response_body: Json;
          p_resource_type?: string | null;
          p_resource_id?: string | null;
        };
        Returns: IdempotencyKeyRow;
      };
      record_invitation_delivery_attempt: {
        Args: {
          p_invitation_id: string;
          p_operation: InvitationDeliveryOperation;
          p_provider: string;
          p_status: InvitationDeliveryStatus;
          p_message_id?: string | null;
          p_error?: string | null;
          p_reason?: string | null;
        };
        Returns: InvitationDeliveryAttemptRow;
      };
    };
  };
};

export type CompanyRow = {
  id: string;
  name: string;
  plan: PlanTier;
  city: string | null;
  country: string | null;
  owner_name: string | null;
  contact_email: string | null;
  reporting_email: string | null;
  status: OrgStatus;
  verification_state: CompanyVerificationState;
  verified_at: string | null;
  vat_id: string | null;
  website: string | null;
  created_at: string;
};

export type EnvelopeRecipientRow = {
  envelope_id: string;
  party_name: string;
  party_email: string;
  status: "pending" | "viewed" | "signed" | "declined";
  signed_at: string | null;
};

export type Co2FactorRow = {
  category: string;
  kg_co2e_per_kg: number | string;
  updated_at: string;
};

export type CompanyCheckRow = {
  id: string;
  company_id: string;
  vat_ok: boolean;
  vat_name: string | null;
  domain_ok: boolean;
  website_ok: boolean;
  outcome: "approved" | "manual_review";
  created_at: string;
};

export type CompanyInsert = Omit<CompanyRow, "id" | "created_at" | "status" | "plan"> &
  Partial<Pick<CompanyRow, "id" | "created_at" | "status" | "plan">>;

export type NgoRow = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  focus: string | null;
  verification_state: NgoVerificationState;
  trust_score: number;
  org_type: NgoOrgType | null;
  board_contact: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  verified_at: string | null;
  tax_authorization_ref: string | null;
  tax_authorization_date: string | null;
  tax_office: string | null;
  registry_number: string | null;
  authorized_signer: string | null;
  authorized_signer_role: string | null;
  proof_notice_date: string | null;
  proof_assessment_period_years: number | null;
  proof_valid_until: string | null;
  proof_expiry_reminded_at: string | null;
  created_at: string;
};

export type NgoInsert = Omit<NgoRow, "id" | "created_at" | "verification_state" | "trust_score"> &
  Partial<Pick<NgoRow, "id" | "created_at" | "verification_state" | "trust_score">>;

export type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  ngo_id: string | null;
  created_at: string;
};

export type UserInsert = Omit<UserRow, "created_at"> & Partial<Pick<UserRow, "created_at">>;

export type InvitationRow = {
  id: string;
  email: string;
  role: UserRole;
  company_id: string | null;
  ngo_id: string | null;
  org_name: string | null;
  status: InvitationStatus;
  expires_at: string | null;
  acceptance_token_hash: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
};

export type InvitationInsert = Omit<InvitationRow, "id" | "created_at" | "status"> &
  Partial<Pick<InvitationRow, "id" | "created_at" | "status">>;

export type InvitationDeliveryAttemptRow = {
  id: string;
  invitation_id: string;
  operation: InvitationDeliveryOperation;
  provider: string;
  status: InvitationDeliveryStatus;
  message_id: string | null;
  error: string | null;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
};

export type InvitationDeliveryAttemptInsert = Omit<
  InvitationDeliveryAttemptRow,
  "id" | "created_at" | "actor_id" | "message_id" | "error" | "reason"
> &
  Partial<Pick<InvitationDeliveryAttemptRow, "id" | "created_at" | "actor_id" | "message_id" | "error" | "reason">>;

export type IdempotencyKeyRow = {
  id: string;
  key: string;
  actor_id: string;
  endpoint_id: string;
  request_hash: string;
  status: IdempotencyStatus;
  response_status: number | null;
  response_body: Json;
  resource_type: string | null;
  resource_id: string | null;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
};

export type IdempotencyKeyInsert = Omit<
  IdempotencyKeyRow,
  | "id"
  | "created_at"
  | "status"
  | "response_status"
  | "response_body"
  | "resource_type"
  | "resource_id"
  | "completed_at"
> &
  Partial<
    Pick<
      IdempotencyKeyRow,
      | "id"
      | "created_at"
      | "status"
      | "response_status"
      | "response_body"
      | "resource_type"
      | "resource_id"
      | "completed_at"
    >
  >;

export type ListingRow = {
  id: string;
  company_id: string;
  title: string;
  category: string;
  subcategory: string | null;
  quantity: number;
  unit: string;
  unit_value: number | null;
  city: string | null;
  country: string | null;
  condition: string | null;
  state: ListingState;
  available_until: string | null;
  pickup_window: string | null;
  packaging: string | null;
  weight_kg: number | null;
  category_details: string | null;
  photos: Json;
  attachments: Json;
  review_flags: Json;
  eligibility: Json;
  created_at: string;
};

export type ListingInsert = Omit<ListingRow, "id" | "created_at" | "state" | "photos" | "attachments" | "review_flags" | "eligibility"> &
  Partial<Pick<ListingRow, "id" | "created_at" | "state" | "photos" | "attachments" | "review_flags" | "eligibility">>;

export type DonationCaseRow = {
  id: string;
  company_id: string;
  title: string;
  step: DonationCaseStep;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  city: string;
  country: string;
  location_notes: string | null;
  time_window: string | null;
  available_from: string | null;
  available_until: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export type DonationCaseInsert = Omit<DonationCaseRow, "id" | "created_at" | "step" | "confirmed_at"> &
  Partial<Pick<DonationCaseRow, "id" | "created_at" | "step" | "confirmed_at">>;

export type DonationPositionRow = {
  id: string;
  case_id: string;
  category: string;
  model: string;
  quantity: number;
  condition: string;
  provenance: string;
  state: DonationPositionState;
  created_at: string;
};

export type DonationPositionInsert = Omit<DonationPositionRow, "id" | "created_at" | "state"> &
  Partial<Pick<DonationPositionRow, "id" | "created_at" | "state">>;

export type DonationAllocationRow = {
  id: string;
  position_id: string;
  case_id: string;
  ngo_id: string;
  quantity: number;
  state: DonationAllocationState;
  position_model: string;
  case_title: string;
  release_note: string | null;
  released_at: string | null;
  created_at: string;
};

export type DonationAllocationInsert = Omit<
  DonationAllocationRow,
  "id" | "created_at" | "state" | "release_note" | "released_at"
> &
  Partial<
    Pick<DonationAllocationRow, "id" | "created_at" | "state" | "release_note" | "released_at">
  >;

export type NeedRow = {
  id: string;
  ngo_id: string;
  title: string;
  category: string;
  subcategory: string | null;
  quantity: number | null;
  quantity_open: boolean;
  urgency: NeedUrgency;
  city: string | null;
  country: string | null;
  target_date: string | null;
  beneficiaries: number | null;
  delivery_preference: NeedDeliveryPreference;
  max_quantity_per_match: number | null;
  target_group: string;
  delivery_address: string;
  has_vehicle: boolean;
  state: NeedState;
  story: string | null;
  created_at: string;
};

export type NeedInsert = Omit<NeedRow, "id" | "created_at" | "state"> &
  Partial<Pick<NeedRow, "id" | "created_at" | "state">>;

export type MatchRow = {
  id: string;
  listing_id: string;
  need_id: string;
  state: MatchState;
  quantity: number;
  score: number | null;
  co2_tons: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  carrier: string | null;
  tracking_ref: string | null;
  committed_at: string | null;
  quota_refunded_at: string | null;
  created_at: string;
};

export type MatchInsert = Omit<MatchRow, "id" | "created_at" | "state"> &
  Partial<Pick<MatchRow, "id" | "created_at" | "state">>;

export type NotificationRow = {
  id: string;
  user_id: string;
  match_id: string | null;
  kind: "proposal_expiring" | "match_status";
  title: string;
  body: string;
  dedupe_key: string;
  created_at: string;
};

export type AccessRequestRow = {
  id: string;
  name: string;
  organization: string;
  role: "corporate" | "ngo";
  email: string;
  phone: string | null;
  message: string | null;
  status?: "new" | "invited" | "declined";
  handled_at?: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  match_id: string;
  author_id: string | null;
  body: string;
  visibility: Visibility;
  created_at: string;
};

export type MessageInsert = Omit<MessageRow, "id" | "created_at" | "visibility"> &
  Partial<Pick<MessageRow, "id" | "created_at" | "visibility">>;

export type AuditEventRow = {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  visibility: Visibility;
  created_at: string;
};

export type SchedulerJobRunRow = {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  records_processed: number | null;
  status: "running" | "ok" | "failed";
  error_text: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
};

export type SchedulerJobRunInsert = Omit<
  SchedulerJobRunRow,
  "id" | "created_at" | "started_at" | "status" | "finished_at" | "records_processed" | "error_text" | "acknowledged_at" | "acknowledged_by"
> &
  Partial<
    Pick<
      SchedulerJobRunRow,
      | "id"
      | "created_at"
      | "started_at"
      | "status"
      | "finished_at"
      | "records_processed"
      | "error_text"
      | "acknowledged_at"
      | "acknowledged_by"
    >
  >;

export type AuditEventInsert = Omit<AuditEventRow, "id" | "created_at" | "visibility"> &
  Partial<Pick<AuditEventRow, "id" | "created_at" | "visibility">>;

export type AgentRunRow = {
  id: string;
  role: UserRole;
  company_id: string | null;
  ngo_id: string | null;
  task_type: string;
  title: string | null;
  prompt: string | null;
  status: AgentRunStatus;
  summary: string | null;
  findings: Json;
  attachments: Json;
  produced_document_id: string | null;
  created_at: string;
  completed_at: string | null;
};

export type AgentRunInsert = Omit<
  AgentRunRow,
  | "id"
  | "created_at"
  | "status"
  | "findings"
  | "attachments"
  | "completed_at"
  | "produced_document_id"
  | "summary"
  | "company_id"
  | "ngo_id"
  | "title"
  | "prompt"
> &
  Partial<
    Pick<
      AgentRunRow,
      | "id"
      | "created_at"
      | "status"
      | "findings"
      | "attachments"
      | "completed_at"
      | "produced_document_id"
      | "summary"
      | "company_id"
      | "ngo_id"
      | "title"
      | "prompt"
    >
  >;

export type AgentProposedActionRow = {
  id: string;
  run_id: string;
  label: string;
  description: string | null;
  status: ProposedActionStatus;
  risk_level: LoopRiskLevel;
  target_type: string | null;
  target_id: string | null;
  proposed_payload: Json;
  requires_human_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
};

export type AgentProposedActionInsert = Omit<
  AgentProposedActionRow,
  | "id"
  | "status"
  | "risk_level"
  | "proposed_payload"
  | "requires_human_approval"
  | "approved_by"
  | "approved_at"
  | "executed_at"
  | "description"
  | "target_type"
  | "target_id"
> &
  Partial<
    Pick<
      AgentProposedActionRow,
      | "id"
      | "status"
      | "risk_level"
      | "proposed_payload"
      | "requires_human_approval"
      | "approved_by"
      | "approved_at"
      | "executed_at"
      | "description"
      | "target_type"
      | "target_id"
    >
  >;

export type DonationCertificateRow = {
  id: string;
  match_id: string;
  status: CertificateStatus;
  fair_value: number | null;
  issued_at: string | null;
  pdf_path: string | null;
};

export type DonationCertificateInsert = Omit<DonationCertificateRow, "id" | "status"> &
  Partial<Pick<DonationCertificateRow, "id" | "status">>;

export type DocumentRow = {
  id: string;
  kind: DocumentKind;
  title: string;
  status: DocumentStatus;
  company_id: string | null;
  ngo_id: string | null;
  match_id: string | null;
  storage_path: string | null;
  mime: string | null;
  size_bytes: number | null;
  created_by: string | null;
  created_at: string;
  published_at: string | null;
};

export type DocumentInsert = Omit<DocumentRow, "id" | "created_at" | "status"> &
  Partial<Pick<DocumentRow, "id" | "created_at" | "status">>;

export type SignatureEnvelopeRow = {
  id: string;
  document_id: string;
  provider: "docuseal" | "documenso" | "manual";
  external_id: string | null;
  state: EnvelopeState;
  subject: string | null;
  audit_url: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  signed_storage_path: string | null;
  signed_at: string | null;
};

export type SignatureEnvelopeInsert = Omit<SignatureEnvelopeRow, "id" | "created_at" | "provider" | "state"> &
  Partial<Pick<SignatureEnvelopeRow, "id" | "created_at" | "provider" | "state">>;

export type PlanEntitlementRow = {
  plan: PlanTier;
  platform_access: boolean;
  matches_per_year: number | null;
  user_seats: number;
  support_level: string;
  csrd_level: string;
  green_procurement_cert: boolean;
  social_media_cards: boolean;
  employer_branding: boolean;
  matching_mode: string;
  ngo_contact_access: boolean;
};

/** Return shape of the open_needs_directory() RPC (anonymised, 0021 / 0067). */
export type OpenNeedRpcRow = {
  need_id: string;
  title: string;
  category: string;
  quantity: number | null;
  quantity_open: boolean;
  urgency: NeedUrgency;
  country: string | null;
  ngo_focus: string | null;
  ngo_country: string | null;
  quantity_remaining: number | null;
  delivery_preference: NeedDeliveryPreference;
  max_quantity_per_match: number | null;
  target_group: string;
};

import type {
  AccessRequestRow,
  EnvelopeRecipientRow,
  SignatureEnvelopeRow,
  Co2FactorRow,
  CompanyCheckRow,
  NotificationRow,
  AgentProposedActionRow,
  AgentRunRow,
  AuditEventRow,
  SchedulerJobRunRow,
  CompanyRow,
  DocumentRow,
  InvitationDeliveryAttemptRow,
  InvitationRow,
  Json,
  DonationAllocationRow,
  DonationCaseRow,
  DonationPositionRow,
  ListingRow,
  MatchRow,
  MessageRow,
  NeedRow,
  OpenNeedRpcRow,
  NgoRow,
  UserRow
} from "./database.types";
import type { AccessRequestInput } from "./access-request-api";
import type { CompanyCheckResult } from "./company-check";
import type { AgentActionOperation } from "./agent-action-api";
import type {
  AccessRequest,
  SignatureEnvelope,
  Co2Factor,
  CompanyCheck,
  Notification,
  AgentAttachment,
  AgentFinding,
  AgentProposedAction,
  AgentRun,
  AuditEvent,
  SchedulerJobRun,
  Company,
  Document,
  DonationAllocation,
  DonationCase,
  DonationPosition,
  Invitation,
  InvitationDeliveryAttempt,
  Listing,
  Match,
  MatchState,
  Message,
  Need,
  Ngo,
  OpenNeedRow,
  PlanTier,
  User
} from "./model";
import {
  createInMemoryRepository,
  type AgentRunCreateResult,
  type DonationAllocationCreateInput,
  type DonationAllocationCreateResult,
  type DonationAllocationReleaseInput,
  type DonationAllocationReleaseResult,
  type DonationCaseCreateInput,
  type DonationCaseConfirmResult,
  type DonationCaseCreateResult,
  type DonationPositionCreateInput,
  type DonationPositionCreateResult,
  type DonationPositionImportResult,
  type InvitationCreateInput,
  type InvitationDeliveryAttemptInput,
  type InvitationDeliveryAttemptResult,
  type InvitationMutationResult,
  type ListingCreateInput,
  type ListingCreateResult,
  type MatchFailureInput,
  type DocusealEvent,
  type MatchProposalInput,
  type SignatureEnvelopeInput,
  type MessageCreateResult,
  type NeedCreateInput,
  type NeedCreateResult,
  type CompanyPlanResult,
  type NgoVerificationResult,
  type ProposedActionResult,
  type RepositoryData,
  type SurplusRepository,
  type TransitionResult
} from "./repository";
import { createDeterministicAgentPlan, normalizeAgentRunInput, type AgentRunInput } from "./agent-planner";
import type { NgoVerificationAction } from "./ngo-verification-api";

export type SupabaseRestConfig = {
  url: string;
  key: string;
  authorization?: string;
  fetchImpl?: typeof fetch;
};

export type SupabaseRepositoryResult = {
  repository: SurplusRepository;
  data: RepositoryData;
};

export class SupabaseRepositoryError extends Error {
  constructor(
    message: string,
    readonly table: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "SupabaseRepositoryError";
  }
}

export async function createSupabaseRestRepository(
  config: SupabaseRestConfig
): Promise<SupabaseRepositoryResult> {
  const data = await loadRepositoryDataFromSupabaseRest(config);

  return {
    repository: createInMemoryRepository(data),
    data
  };
}

export async function loadRepositoryDataFromSupabaseRest(config: SupabaseRestConfig): Promise<RepositoryData> {
  const [
    accessRequests,
    notifications,
    companyChecks,
    co2Factors,
    envelopes,
    envelopeRecipients,
    companies,
    ngos,
    users,
    invitations,
    invitationDeliveryAttempts,
    listings,
    donationCases,
    donationPositions,
    donationAllocations,
    needs,
    matches,
    messages,
    documents,
    auditEvents,
    agentRuns,
    proposedActions,
    schedulerJobRuns
  ] = await Promise.all([
    selectRows<AccessRequestRow>(config, "access_requests", "created_at.desc"),
    selectRows<NotificationRow>(config, "notifications", "created_at.desc"),
    selectRows<CompanyCheckRow>(config, "company_checks", "created_at.desc"),
    selectRows<Co2FactorRow>(config, "co2_factors", "category.asc"),
    selectRows<SignatureEnvelopeRow>(config, "signature_envelopes", "created_at.desc"),
    selectRows<EnvelopeRecipientRow>(config, "envelope_recipients", "party_email.asc"),
    selectRows<CompanyRow>(config, "companies", "created_at.asc"),
    selectRows<NgoRow>(config, "ngos", "created_at.asc"),
    selectRows<UserRow>(config, "users", "created_at.asc"),
    selectRows<InvitationRow>(config, "invitations", "created_at.desc"),
    selectRows<InvitationDeliveryAttemptRow>(config, "invitation_delivery_attempts", "created_at.desc"),
    selectRows<ListingRow>(config, "listings", "created_at.asc"),
    // Soft-fail until migration 0065 is applied — missing table must not brick login.
    selectRowsOptional<DonationCaseRow>(config, "donation_cases", "created_at.asc"),
    selectRowsOptional<DonationPositionRow>(config, "donation_positions", "created_at.asc"),
    // Soft-fail until migration 0070 is applied.
    selectRowsOptional<DonationAllocationRow>(config, "donation_allocations", "created_at.asc"),
    selectRows<NeedRow>(config, "needs", "created_at.asc"),
    selectRows<MatchRow>(config, "matches", "created_at.asc"),
    selectRows<MessageRow>(config, "messages", "created_at.asc"),
    selectRows<DocumentRow>(config, "documents", "created_at.desc"),
    selectRows<AuditEventRow>(config, "audit_events", "created_at.desc"),
    selectRows<AgentRunRow>(config, "agent_runs", "created_at.desc"),
    selectRows<AgentProposedActionRow>(config, "agent_proposed_actions", "id.asc"),
    // Soft-fail until migration 0057 is applied — missing table must not brick login.
    selectRowsOptional<SchedulerJobRunRow>(config, "scheduler_job_runs", "started_at.desc")
  ]);

  return {
    accessRequests: accessRequests.map(accessRequestFromRow),
    notifications: notifications.map(notificationFromRow),
    companyChecks: companyChecks.map(companyCheckFromRow),
    co2Factors: co2Factors.map(co2FactorFromRow),
    signatureEnvelopes: envelopes.map((row) => envelopeFromRow(row, envelopeRecipients)),
    companies: companies.map(companyFromRow),
    ngos: ngos.map(ngoFromRow),
    users: users.map(userFromRow),
    invitations: invitations.map(invitationFromRow),
    invitationDeliveryAttempts: invitationDeliveryAttempts.map(invitationDeliveryAttemptFromRow),
    listings: listings.map(listingFromRow),
    donationCases: donationCases.map(donationCaseFromRow),
    donationPositions: donationPositions.map(donationPositionFromRow),
    donationAllocations: donationAllocations.map(donationAllocationFromRow),
    needs: needs.map(needFromRow),
    matches: matches.map(matchFromRow),
    messages: messages.map(messageFromRow),
    documents: documents.map(documentFromRow),
    auditEvents: auditEvents.map(auditEventFromRow),
    agentRuns: agentRuns.map(agentRunFromRow),
    proposedActions: proposedActions.map(agentProposedActionFromRow),
    schedulerJobRuns: schedulerJobRuns.map(schedulerJobRunFromRow)
  };
}

export async function createInvitationWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: InvitationCreateInput
): Promise<Invitation> {
  const row = await callRpc<InvitationRow>(config, "create_invitation", {
    p_email: input.email,
    p_role: input.role,
    p_company_id: input.companyId ?? null,
    p_ngo_id: input.ngoId ?? null,
    p_org_name: input.orgName ?? null,
    p_expires_at: input.expiresAt ?? null,
    p_acceptance_token_hash: input.acceptanceTokenHash ?? null
  });

  return invitationFromRow(row);
}

export type InvitationAcceptanceInput = {
  acceptanceToken: string;
  fullName?: string | null;
};

export async function acceptInvitationWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: InvitationAcceptanceInput
): Promise<User> {
  const row = await callRpc<UserRow>(config, "accept_invitation", {
    p_acceptance_token: input.acceptanceToken,
    p_full_name: input.fullName ?? null
  });

  return userFromRow(row);
}

export async function revokeInvitationWithSupabaseRpc(
  config: SupabaseRestConfig,
  invitationId: string
): Promise<InvitationMutationResult> {
  const row = await callRpc<InvitationRow>(config, "revoke_invitation", {
    p_invitation_id: invitationId
  });

  return {
    ok: true,
    invitation: invitationFromRow(row)
  };
}

export async function resendInvitationWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: {
    acceptanceTokenHash: string;
    invitationId: string;
  }
): Promise<InvitationMutationResult> {
  const row = await callRpc<InvitationRow>(config, "resend_invitation", {
    p_invitation_id: input.invitationId,
    p_acceptance_token_hash: input.acceptanceTokenHash
  });

  return {
    ok: true,
    invitation: invitationFromRow(row)
  };
}

export async function recordInvitationDeliveryAttemptWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: InvitationDeliveryAttemptInput
): Promise<InvitationDeliveryAttemptResult> {
  const row = await callRpc<InvitationDeliveryAttemptRow>(config, "record_invitation_delivery_attempt", {
    p_invitation_id: input.invitationId,
    p_operation: input.operation,
    p_provider: input.provider,
    p_status: input.status,
    p_message_id: input.messageId ?? null,
    p_error: input.error ?? null,
    p_reason: input.reason ?? null
  });

  return {
    ok: true,
    attempt: invitationDeliveryAttemptFromRow(row)
  };
}

export async function createAgentRunWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: AgentRunInput
): Promise<AgentRunCreateResult> {
  const task = normalizeAgentRunInput(input);
  if (!task) return { ok: false, reason: "invalid_task" };

  const plan = createDeterministicAgentPlan(task);
  const payload = await callRpc<unknown>(config, "create_agent_run", {
    p_task_type: task.taskType,
    p_prompt: task.prompt,
    p_target_type: task.targetType ?? null,
    p_target_id: task.targetId ?? null,
    p_title: plan.title,
    p_summary: plan.summary,
    p_findings: plan.findings,
    p_attachments: task.attachments ?? [],
    p_document: plan.document
      ? {
          kind: plan.document.kind,
          title: plan.document.title,
          status: plan.document.status,
          matchId: plan.document.matchId,
          storagePath: plan.document.storagePath,
          mime: plan.document.mime,
          sizeBytes: plan.document.sizeBytes
        }
      : null,
    p_proposed_actions: plan.proposedActions.map((action) => ({
      label: action.label,
      description: action.description,
      riskLevel: action.riskLevel,
      targetType: action.targetType,
      targetId: action.targetId,
      proposedPayload: action.proposedPayload
    }))
  });
  const result = objectPayload(payload, "create_agent_run");

  return {
    ok: true,
    run: agentRunFromPayload(result.run),
    actions: arrayPayload(result.actions, "create_agent_run.actions").map(agentActionFromPayload),
    document: result.document === null ? null : documentFromPayload(result.document)
  };
}

export async function performAgentActionWithSupabaseRpc(
  config: SupabaseRestConfig,
  operation: AgentActionOperation,
  actionId: string
): Promise<ProposedActionResult> {
  const payload = await callRpc<unknown>(config, "perform_agent_action", {
    p_action_id: actionId,
    p_operation: operation
  });

  return {
    ok: true,
    action: agentActionFromPayload(payload)
  };
}

export async function createMessageWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: {
    matchId: string;
    body: string;
  }
): Promise<MessageCreateResult> {
  const payload = await callRpc<unknown>(config, "create_message", {
    p_match_id: input.matchId,
    p_body: input.body
  });

  return {
    ok: true,
    message: messageFromPayload(payload)
  };
}

export async function createListingWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: ListingCreateInput
): Promise<ListingCreateResult> {
  const row = await callRpc<ListingRow>(config, "create_listing", {
    p_title: input.title,
    p_category: input.category,
    p_quantity: input.quantity,
    p_unit_value: input.unitValue,
    p_city: input.city,
    p_country: input.country,
    p_condition: input.condition,
    p_eligibility_usable: input.eligibility.usable,
    p_eligibility_policy_fit: input.eligibility.policyFit,
    p_eligibility_ownership: input.eligibility.ownership,
    p_subcategory: input.subcategory ?? null,
    p_unit: input.unit ?? null,
    p_available_until: input.availableUntil ?? null,
    p_pickup_window: input.pickupWindow ?? null,
    p_packaging: input.packaging ?? null,
    p_weight_kg: input.weightKg ?? null,
    p_category_details: input.categoryDetails ?? null,
    p_company_id: input.companyId ?? null
  });

  return {
    ok: true,
    listing: listingFromRow(row)
  };
}

export async function createDonationCaseWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: DonationCaseCreateInput
): Promise<DonationCaseCreateResult> {
  const row = await callRpc<DonationCaseRow>(config, "create_donation_case", {
    p_title: input.title,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_city: input.city,
    p_country: input.country,
    p_contact_phone: input.contactPhone ?? null,
    p_location_notes: input.locationNotes ?? null,
    p_time_window: input.timeWindow ?? null,
    p_available_from: input.availableFrom ?? null,
    p_available_until: input.availableUntil ?? null,
    p_company_id: input.companyId ?? null
  });

  return { ok: true, donationCase: donationCaseFromRow(row) };
}

export async function confirmDonationCaseWithSupabaseRpc(
  config: SupabaseRestConfig,
  caseId: string
): Promise<DonationCaseConfirmResult> {
  const row = await callRpc<DonationCaseRow>(config, "confirm_donation_case", {
    p_case_id: caseId
  });

  return { ok: true, donationCase: donationCaseFromRow(row) };
}

export async function addDonationPositionWithSupabaseRpc(
  config: SupabaseRestConfig,
  caseId: string,
  input: DonationPositionCreateInput
): Promise<DonationPositionCreateResult> {
  const row = await callRpc<DonationPositionRow>(config, "add_donation_position", {
    p_case_id: caseId,
    p_category: input.category,
    p_model: input.model,
    p_quantity: input.quantity,
    p_condition: input.condition,
    p_provenance: input.provenance
  });
  const cases = await selectRowsOptional<DonationCaseRow>(config, "donation_cases", "created_at.asc");
  const donationCase = cases.map(donationCaseFromRow).find((item) => item.id === caseId);
  if (!donationCase) {
    throw new SupabaseRepositoryError("case_not_found", "donation_cases");
  }

  return { ok: true, position: donationPositionFromRow(row), donationCase };
}

export async function importDonationPositionsWithSupabaseRpc(
  config: SupabaseRestConfig,
  caseId: string,
  inputs: DonationPositionCreateInput[]
): Promise<DonationPositionImportResult> {
  const rows = await callRpcList<DonationPositionRow>(config, "import_donation_positions", {
    p_case_id: caseId,
    p_positions: inputs.map((input) => ({
      category: input.category,
      model: input.model,
      quantity: input.quantity,
      condition: input.condition,
      provenance: input.provenance
    }))
  });
  const cases = await selectRowsOptional<DonationCaseRow>(config, "donation_cases", "created_at.asc");
  const donationCase = cases.map(donationCaseFromRow).find((item) => item.id === caseId);
  if (!donationCase) {
    throw new SupabaseRepositoryError("case_not_found", "donation_cases");
  }

  return {
    ok: true,
    positions: rows.map(donationPositionFromRow),
    donationCase
  };
}

export async function createDonationAllocationWithSupabaseRpc(
  config: SupabaseRestConfig,
  caseId: string,
  input: DonationAllocationCreateInput
): Promise<DonationAllocationCreateResult> {
  const row = await callRpc<DonationAllocationRow>(config, "create_donation_allocation", {
    p_case_id: caseId,
    p_position_id: input.positionId,
    p_ngo_id: input.ngoId,
    p_quantity: input.quantity
  });
  const positions = await selectRowsOptional<DonationPositionRow>(
    config,
    "donation_positions",
    "created_at.asc"
  );
  const position = positions.map(donationPositionFromRow).find((item) => item.id === row.position_id);
  if (!position) {
    throw new SupabaseRepositoryError("position_not_found", "donation_positions");
  }

  return { ok: true, allocation: donationAllocationFromRow(row), position };
}

export async function releaseDonationAllocationWithSupabaseRpc(
  config: SupabaseRestConfig,
  allocationId: string,
  input: DonationAllocationReleaseInput
): Promise<DonationAllocationReleaseResult> {
  const row = await callRpc<DonationAllocationRow>(config, "release_donation_allocation", {
    p_allocation_id: allocationId,
    p_release_note: input.releaseNote
  });
  // The release is committed at this point. The position is informational: an
  // NGO cannot read donation_positions under RLS (0065), and a failed re-read
  // must not turn a successful release into an error response.
  const position = await selectRowsOptional<DonationPositionRow>(
    config,
    "donation_positions",
    "created_at.asc"
  )
    .then(
      (rows) =>
        rows.map(donationPositionFromRow).find((item) => item.id === row.position_id) ?? null
    )
    .catch(() => null);

  return { ok: true, allocation: donationAllocationFromRow(row), position };
}

export async function createNeedWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: NeedCreateInput
): Promise<NeedCreateResult> {
  const row = await callRpc<NeedRow>(config, "create_need", {
    p_title: input.title,
    p_category: input.category,
    p_quantity: input.quantity ?? null,
    p_city: input.city,
    p_country: input.country,
    p_target_date: input.targetDate ?? null,
    p_beneficiaries: input.beneficiaries ?? null,
    p_story: input.story ?? null,
    p_subcategory: input.subcategory ?? null,
    p_urgency: input.urgency ?? "flexible",
    p_quantity_open: input.quantityOpen ?? false,
    p_delivery_preference: input.deliveryPreference ?? "either",
    p_max_quantity_per_match: input.maxQuantityPerMatch ?? null,
    p_target_group: input.targetGroup,
    p_delivery_address: input.deliveryAddress,
    p_has_vehicle: input.hasVehicle ?? false,
    p_ngo_id: input.ngoId ?? null
  });

  return {
    ok: true,
    need: needFromRow(row)
  };
}

export async function transitionMatchWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: {
    matchId: string;
    nextState: MatchState;
  }
): Promise<TransitionResult> {
  const row = await callRpc<MatchRow>(config, "transition_match", {
    p_match_id: input.matchId,
    p_next_state: input.nextState
  });

  return {
    ok: true,
    match: matchFromRow(row)
  };
}

/**
 * The public "Request access" form. Runs with the anon key (no session). The
 * RPC returns nothing on purpose: the caller must never learn whether an email
 * was already on the list.
 */
export async function submitAccessRequestWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: AccessRequestInput
): Promise<void> {
  await postRpc(config, "submit_access_request", {
    p_name: input.name,
    p_organization: input.organization,
    p_role: input.role,
    p_email: input.email,
    p_phone: input.phone,
    p_message: input.message
  });
}

export async function failMatchWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: MatchFailureInput & { matchId: string }
): Promise<TransitionResult> {
  const row = await callRpc<MatchRow>(config, "fail_match", {
    p_match_id: input.matchId,
    p_ngo_at_fault: input.ngoAtFault,
    p_reason: input.reason ?? null
  });

  return { ok: true, match: matchFromRow(row) };
}

/**
 * Store an automatic company check. The RPC is executable by the service role
 * only, so `config` must carry the service-role key (server side, never a user
 * session): the network checks run on the server and must not be forgeable.
 */
export async function recordCompanyCheckWithServiceRole(
  config: SupabaseRestConfig,
  input: CompanyCheckResult & { companyId: string; vatId: string; website: string }
): Promise<void> {
  await postRpc(config, "record_company_check", {
    p_company: input.companyId,
    p_vat_id: input.vatId,
    p_website: input.website,
    p_vat_ok: input.vatOk,
    p_vat_name: input.vatName,
    p_domain_ok: input.domainOk,
    p_website_ok: input.websiteOk
  });
}

export async function removeCompanyMemberWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: { userId: string }
): Promise<{ ok: true }> {
  await postRpc(config, "remove_company_member", { p_user: input.userId });

  return { ok: true };
}

/**
 * One request against a rate-limit window shared by every server instance.
 * `config` must carry the service-role key: the RPC is not callable by user
 * sessions, so nobody can spend another actor's budget (0052).
 */
export async function reserveSharedRateLimitWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: { key: string; limit: number; windowSeconds: number }
): Promise<{ ok: true; limit: number; remaining: number; resetAt: number } | { ok: false; limit: number; retryAfterSeconds: number; resetAt: number }> {
  const rows = (await postRpc(config, "reserve_rate_limit", {
    p_key: input.key,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds
  })) as Array<{ allowed: boolean; remaining: number; reset_at: string }> | null;
  const row = rows?.[0];
  if (!row) throw new SupabaseRepositoryError("reserve_rate_limit returned no row", "reserve_rate_limit");

  const resetAt = Date.parse(row.reset_at);
  if (row.allowed) return { ok: true, limit: input.limit, remaining: row.remaining, resetAt };

  return { ok: false, limit: input.limit, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)), resetAt };
}

/**
 * Activate a paid plan after Stripe confirmed payment. Service role only (0053):
 * the plan must never change on the word of a browser. Returns false for a
 * redelivered event or a plan the company already has or exceeds.
 */
export async function activatePlanFromPaymentWithServiceRole(
  config: SupabaseRestConfig,
  input: { companyId: string; plan: "seed" | "tree"; eventId: string }
): Promise<boolean> {
  const result = await postRpc(config, "activate_company_plan_from_payment", {
    p_company: input.companyId,
    p_plan: input.plan,
    p_event_id: input.eventId
  });

  return result === true;
}

export async function setCo2FactorWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: { category: string; kgCo2ePerKg: number }
): Promise<{ ok: true }> {
  await postRpc(config, "set_co2_factor", { p_category: input.category, p_kg_co2e_per_kg: input.kgCo2ePerKg });

  return { ok: true };
}

export async function createSignatureEnvelopeWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: SignatureEnvelopeInput
): Promise<{ ok: true }> {
  await postRpc(config, "create_signature_envelope", {
    p_document: input.documentId,
    p_external_id: input.externalId,
    p_subject: "Donation certificate",
    p_company_name: input.companyName,
    p_company_email: input.companyEmail,
    p_ngo_name: input.ngoName,
    p_ngo_email: input.ngoEmail
  });

  return { ok: true };
}

/**
 * Apply a verified DocuSeal webhook event. Service role only (0055): signature
 * status must never change on the word of a user session (invariant 5).
 */
export async function applyDocusealEventWithServiceRole(config: SupabaseRestConfig, input: DocusealEvent): Promise<string> {
  const state = await postRpc(config, "apply_docuseal_event", {
    p_external_id: input.externalId,
    p_event: input.event,
    p_email: input.email ?? null,
    p_audit_url: null,
    p_signed_path: input.signedStoragePath ?? null
  });

  return String(state);
}

export async function proposeMatchWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: MatchProposalInput
): Promise<TransitionResult> {
  const row = await callRpc<MatchRow>(config, "propose_match", {
    p_listing_id: input.listingId,
    p_need_id: input.needId,
    p_quantity: input.quantity ?? null
  });

  return {
    ok: true,
    match: matchFromRow(row)
  };
}

export async function setNgoVerificationWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: {
    ngoId: string;
    action: NgoVerificationAction;
    proofNoticeDate?: string | null;
    proofAssessmentPeriodYears?: number | null;
  }
): Promise<NgoVerificationResult> {
  const row = await callRpc<NgoRow>(config, "set_ngo_verification", {
    p_ngo_id: input.ngoId,
    p_action: input.action,
    p_proof_notice_date: input.proofNoticeDate ?? null,
    p_proof_assessment_period_years: input.proofAssessmentPeriodYears ?? null
  });

  return {
    ok: true,
    ngo: ngoFromRow(row)
  };
}

/**
 * The needs directory any authenticated corporate may browse — anonymised
 * since 0021. The RPC's column list is the gate: it cannot return a name or a
 * contact even if a caller asks, so no mapping here can leak what the plan
 * withholds.
 */
export async function setCompanyPlanWithSupabaseRpc(
  config: SupabaseRestConfig,
  input: { companyId: string; plan: PlanTier }
): Promise<CompanyPlanResult> {
  const row = await callRpc<CompanyRow>(config, "set_company_plan", {
    p_company_id: input.companyId,
    p_plan: input.plan
  });

  return { ok: true, company: companyFromRow(row) };
}

export async function fetchOpenNeedsDirectoryWithSupabase(
  config: SupabaseRestConfig
): Promise<OpenNeedRow[]> {
  const rows = await callRpcList<OpenNeedRpcRow>(config, "open_needs_directory", {});

  return rows.map((row) => ({
    needId: row.need_id,
    title: row.title,
    category: row.category,
    quantity: row.quantity,
    quantityOpen: row.quantity_open,
    urgency: row.urgency,
    country: row.country,
    ngoFocus: row.ngo_focus,
    ngoCountry: row.ngo_country,
    quantityRemaining: row.quantity_remaining,
    deliveryPreference: row.delivery_preference ?? "either",
    maxQuantityPerMatch: row.max_quantity_per_match,
    targetGroup: row.target_group ?? ""
  }));
}

async function selectRows<Row>(
  config: SupabaseRestConfig,
  table: string,
  order: string
): Promise<Row[]> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = new URL(`/rest/v1/${table}`, normalizedSupabaseUrl(config.url));
  endpoint.searchParams.set("select", "*");
  endpoint.searchParams.set("order", order);

  const response = await fetchImpl(endpoint, {
    headers: authHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body ? `: ${body.slice(0, 240)}` : "";
    throw new SupabaseRepositoryError(
      `Failed to load ${table} from Supabase (${response.status})${detail}`,
      table,
      response.status
    );
  }

  return (await response.json()) as Row[];
}

/** Like selectRows, but a missing table (PostgREST PGRST205 / 404) returns []. */
async function selectRowsOptional<Row>(
  config: SupabaseRestConfig,
  table: string,
  order: string
): Promise<Row[]> {
  try {
    return await selectRows<Row>(config, table, order);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

async function postRpc(
  config: SupabaseRestConfig,
  functionName: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const fetchImpl = config.fetchImpl ?? fetch;
  const endpoint = new URL(`/rest/v1/rpc/${functionName}`, normalizedSupabaseUrl(config.url));

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      ...authHeaders(config),
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    const detail = responseBody ? `: ${responseBody.slice(0, 240)}` : "";
    throw new SupabaseRepositoryError(
      `Failed to call ${functionName} on Supabase (${response.status})${detail}`,
      functionName,
      response.status
    );
  }

  // void RPCs answer with an empty body
  return response.json().catch(() => null);
}

/** Single-row RPCs: unwraps a one-element array or object, else throws. */
async function callRpc<Row>(
  config: SupabaseRestConfig,
  functionName: string,
  body: Record<string, unknown>
): Promise<Row> {
  const payload = await postRpc(config, functionName, body);
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (!first || typeof first !== "object") {
      throw new SupabaseRepositoryError(`Supabase RPC ${functionName} returned no row`, functionName);
    }

    return first as Row;
  }
  if (!payload || typeof payload !== "object") {
    throw new SupabaseRepositoryError(`Supabase RPC ${functionName} returned no row`, functionName);
  }

  return payload as Row;
}

/**
 * Set-returning RPCs (e.g. open_needs_directory): returns every row, and an
 * empty result is a valid empty list — never an error. Using callRpc here
 * would wrongly reject an empty directory and mis-handle a populated one.
 */
async function callRpcList<Row>(
  config: SupabaseRestConfig,
  functionName: string,
  body: Record<string, unknown>
): Promise<Row[]> {
  const payload = await postRpc(config, functionName, body);
  if (!Array.isArray(payload)) {
    throw new SupabaseRepositoryError(
      `Supabase RPC ${functionName} did not return a list`,
      functionName
    );
  }

  return payload as Row[];
}

function authHeaders(config: SupabaseRestConfig): Record<string, string> {
  return {
    apikey: config.key,
    authorization: config.authorization ?? `Bearer ${config.key}`
  };
}

function normalizedSupabaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function envelopeFromRow(row: SignatureEnvelopeRow, recipients: EnvelopeRecipientRow[]): SignatureEnvelope {
  return {
    id: row.id,
    documentId: row.document_id,
    externalId: row.external_id ?? "",
    state: row.state,
    recipients: recipients
      .filter((item) => item.envelope_id === row.id)
      .map((item) => ({
        partyName: item.party_name,
        partyEmail: item.party_email,
        status: item.status,
        signedAt: item.signed_at
      })),
    signedStoragePath: row.signed_storage_path,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function co2FactorFromRow(row: Co2FactorRow): Co2Factor {
  return { category: row.category, kgCo2ePerKg: Number(row.kg_co2e_per_kg), updatedAt: row.updated_at };
}

function companyCheckFromRow(row: CompanyCheckRow): CompanyCheck {
  return {
    id: row.id,
    companyId: row.company_id,
    vatOk: row.vat_ok,
    vatName: row.vat_name,
    domainOk: row.domain_ok,
    websiteOk: row.website_ok,
    outcome: row.outcome,
    createdAt: row.created_at
  };
}

function notificationFromRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    matchId: row.match_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    dedupeKey: row.dedupe_key,
    createdAt: row.created_at
  };
}

function accessRequestFromRow(row: AccessRequestRow): AccessRequest {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization,
    role: row.role,
    email: row.email,
    phone: row.phone,
    message: row.message,
    status: row.status ?? "new",
    createdAt: row.created_at
  };
}

function companyFromRow(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    plan: row.plan,
    status: row.status,
    city: row.city ?? "",
    country: row.country ?? "",
    ownerName: row.owner_name ?? "",
    contactEmail: row.contact_email ?? "",
    reportingEmail: row.reporting_email ?? "",
    verificationState: row.verification_state,
    verifiedAt: row.verified_at,
    vatId: row.vat_id,
    website: row.website,
    createdAt: row.created_at
  };
}

function ngoFromRow(row: NgoRow): Ngo {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? "",
    country: row.country ?? "",
    focus: row.focus ?? "",
    verificationState: row.verification_state,
    trustScore: row.trust_score,
    boardContact: row.board_contact ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    address: row.address ?? "",
    verifiedAt: row.verified_at,
    orgType: row.org_type,
    taxAuthorizationRef: row.tax_authorization_ref,
    taxAuthorizationDate: row.tax_authorization_date,
    taxOffice: row.tax_office,
    registryNumber: row.registry_number,
    authorizedSigner: row.authorized_signer,
    authorizedSignerRole: row.authorized_signer_role,
    proofNoticeDate: row.proof_notice_date,
    proofAssessmentPeriodYears: row.proof_assessment_period_years,
    proofValidUntil: row.proof_valid_until,
    proofExpiryRemindedAt: row.proof_expiry_reminded_at,
    createdAt: row.created_at
  };
}

function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? "",
    role: row.role,
    companyId: row.company_id,
    ngoId: row.ngo_id,
    createdAt: row.created_at
  };
}

function invitationFromRow(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
    ngoId: row.ngo_id,
    orgName: row.org_name,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    createdAt: row.created_at
  };
}

function invitationDeliveryAttemptFromRow(row: InvitationDeliveryAttemptRow): InvitationDeliveryAttempt {
  return {
    id: row.id,
    invitationId: row.invitation_id,
    operation: row.operation,
    provider: row.provider,
    status: row.status,
    messageId: row.message_id,
    error: row.error,
    reason: row.reason,
    actorId: row.actor_id,
    createdAt: row.created_at
  };
}

function listingFromRow(row: ListingRow): Listing {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    category: row.category,
    subcategory: row.subcategory,
    quantity: row.quantity,
    unit: row.unit,
    unitValue: row.unit_value ?? 0,
    city: row.city ?? "",
    country: row.country ?? "",
    condition: row.condition ?? "",
    state: row.state,
    availableUntil: row.available_until,
    pickupWindow: row.pickup_window ?? "",
    packaging: row.packaging ?? "",
    weightKg: row.weight_kg ?? 0,
    categoryDetails: row.category_details ?? "",
    photos: stringArray(row.photos),
    attachments: stringArray(row.attachments),
    reviewFlags: stringArray(row.review_flags),
    eligibility: eligibilityFromJson(row.eligibility),
    createdAt: row.created_at
  };
}

function donationCaseFromRow(row: DonationCaseRow): DonationCase {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    step: row.step,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    city: row.city,
    country: row.country,
    locationNotes: row.location_notes,
    timeWindow: row.time_window,
    availableFrom: row.available_from,
    availableUntil: row.available_until,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at
  };
}

function donationPositionFromRow(row: DonationPositionRow): DonationPosition {
  return {
    id: row.id,
    caseId: row.case_id,
    category: row.category,
    model: row.model,
    quantity: row.quantity,
    condition: row.condition,
    provenance: row.provenance,
    state: row.state,
    createdAt: row.created_at
  };
}

function donationAllocationFromRow(row: DonationAllocationRow): DonationAllocation {
  return {
    id: row.id,
    positionId: row.position_id,
    caseId: row.case_id,
    ngoId: row.ngo_id,
    quantity: row.quantity,
    state: row.state,
    positionModel: row.position_model,
    caseTitle: row.case_title,
    releaseNote: row.release_note,
    releasedAt: row.released_at,
    createdAt: row.created_at
  };
}

function needFromRow(row: NeedRow): Need {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    title: row.title,
    category: row.category,
    subcategory: row.subcategory,
    // Honest null. This used to coerce to 0, which reads as "needs zero of
    // these" — the opposite of "did not say how many".
    quantity: row.quantity,
    quantityOpen: row.quantity_open ?? false,
    urgency: row.urgency ?? "flexible",
    city: row.city ?? "",
    country: row.country ?? "",
    targetDate: row.target_date,
    beneficiaries: row.beneficiaries ?? 0,
    deliveryPreference: row.delivery_preference ?? "either",
    maxQuantityPerMatch: row.max_quantity_per_match,
    targetGroup: row.target_group ?? "",
    deliveryAddress: row.delivery_address ?? "",
    hasVehicle: row.has_vehicle ?? false,
    state: row.state,
    story: row.story ?? "",
    createdAt: row.created_at
  };
}

function matchFromRow(row: MatchRow): Match {
  return {
    id: row.id,
    listingId: row.listing_id,
    needId: row.need_id,
    state: row.state,
    quantity: row.quantity,
    score: row.score ?? 0,
    co2Tons: row.co2_tons ?? 0,
    pickupDate: row.pickup_date,
    deliveryDate: row.delivery_date,
    carrier: row.carrier,
    trackingRef: row.tracking_ref,
    committedAt: row.committed_at,
    quotaRefundedAt: row.quota_refunded_at,
    createdAt: row.created_at
  };
}

function messageFromRow(row: MessageRow): Message {
  return {
    id: row.id,
    matchId: row.match_id,
    authorId: row.author_id,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at
  };
}

function messageFromPayload(value: unknown): Message {
  const payload = objectPayload(value, "message");

  return {
    id: stringPayload(payload.id, "message.id"),
    matchId: stringPayload(payload.matchId, "message.matchId"),
    authorId: nullableStringPayload(payload.authorId, "message.authorId"),
    body: stringPayload(payload.body, "message.body"),
    visibility: stringPayload(payload.visibility, "message.visibility") as Message["visibility"],
    createdAt: stringPayload(payload.createdAt, "message.createdAt")
  };
}

function documentFromRow(row: DocumentRow): Document {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    status: row.status,
    companyId: row.company_id,
    ngoId: row.ngo_id,
    matchId: row.match_id,
    storagePath: row.storage_path,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at
  };
}

function auditEventFromRow(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target ?? "",
    visibility: row.visibility,
    createdAt: row.created_at
  };
}

function schedulerJobRunFromRow(row: SchedulerJobRunRow): SchedulerJobRun {
  return {
    id: row.id,
    jobName: row.job_name,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    recordsProcessed: row.records_processed,
    status: row.status,
    errorText: row.error_text,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    createdAt: row.created_at
  };
}

function agentRunFromRow(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    role: row.role,
    companyId: row.company_id,
    ngoId: row.ngo_id,
    taskType: row.task_type,
    title: row.title ?? "",
    prompt: row.prompt ?? "",
    status: row.status,
    summary: row.summary ?? "",
    findings: agentFindings(row.findings),
    attachments: agentAttachments(row.attachments),
    producedDocumentId: row.produced_document_id,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

function agentProposedActionFromRow(row: AgentProposedActionRow): AgentProposedAction {
  return {
    id: row.id,
    runId: row.run_id,
    label: row.label,
    description: row.description ?? "",
    status: row.status,
    riskLevel: row.risk_level,
    targetType: row.target_type,
    targetId: row.target_id,
    proposedPayload: jsonObject(row.proposed_payload),
    requiresHumanApproval: true,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    executedAt: row.executed_at
  };
}

function agentRunFromPayload(value: unknown): AgentRun {
  const payload = objectPayload(value, "agent_run");

  return {
    id: stringPayload(payload.id, "agent_run.id"),
    role: stringPayload(payload.role, "agent_run.role") as AgentRun["role"],
    companyId: nullableStringPayload(payload.companyId, "agent_run.companyId"),
    ngoId: nullableStringPayload(payload.ngoId, "agent_run.ngoId"),
    taskType: stringPayload(payload.taskType, "agent_run.taskType"),
    title: stringPayload(payload.title, "agent_run.title"),
    prompt: stringPayload(payload.prompt, "agent_run.prompt"),
    status: stringPayload(payload.status, "agent_run.status") as AgentRun["status"],
    summary: stringPayload(payload.summary, "agent_run.summary"),
    findings: agentFindings(payload.findings as Json),
    attachments: agentAttachments(payload.attachments as Json),
    producedDocumentId: nullableStringPayload(payload.producedDocumentId, "agent_run.producedDocumentId"),
    createdAt: stringPayload(payload.createdAt, "agent_run.createdAt"),
    completedAt: nullableStringPayload(payload.completedAt, "agent_run.completedAt")
  };
}

function agentActionFromPayload(value: unknown): AgentProposedAction {
  const payload = objectPayload(value, "agent_action");
  if (payload.requiresHumanApproval !== true) {
    throw new SupabaseRepositoryError("Malformed Supabase RPC payload from agent_action.requiresHumanApproval", "agent_action");
  }

  return {
    id: stringPayload(payload.id, "agent_action.id"),
    runId: stringPayload(payload.runId, "agent_action.runId"),
    label: stringPayload(payload.label, "agent_action.label"),
    description: stringPayload(payload.description, "agent_action.description"),
    status: stringPayload(payload.status, "agent_action.status") as AgentProposedAction["status"],
    riskLevel: stringPayload(payload.riskLevel, "agent_action.riskLevel") as AgentProposedAction["riskLevel"],
    targetType: nullableStringPayload(payload.targetType, "agent_action.targetType"),
    targetId: nullableStringPayload(payload.targetId, "agent_action.targetId"),
    proposedPayload: jsonObject(payload.proposedPayload as Json),
    requiresHumanApproval: true,
    approvedBy: nullableStringPayload(payload.approvedBy, "agent_action.approvedBy"),
    approvedAt: nullableStringPayload(payload.approvedAt, "agent_action.approvedAt"),
    executedAt: nullableStringPayload(payload.executedAt, "agent_action.executedAt")
  };
}

function documentFromPayload(value: unknown): Document {
  const payload = objectPayload(value, "document");

  return {
    id: stringPayload(payload.id, "document.id"),
    kind: stringPayload(payload.kind, "document.kind") as Document["kind"],
    title: stringPayload(payload.title, "document.title"),
    status: stringPayload(payload.status, "document.status") as Document["status"],
    companyId: nullableStringPayload(payload.companyId, "document.companyId"),
    ngoId: nullableStringPayload(payload.ngoId, "document.ngoId"),
    matchId: nullableStringPayload(payload.matchId, "document.matchId"),
    storagePath: nullableStringPayload(payload.storagePath, "document.storagePath"),
    mime: nullableStringPayload(payload.mime, "document.mime"),
    sizeBytes: numberPayload(payload.sizeBytes, "document.sizeBytes"),
    createdBy: nullableStringPayload(payload.createdBy, "document.createdBy"),
    createdAt: stringPayload(payload.createdAt, "document.createdAt"),
    publishedAt: nullableStringPayload(payload.publishedAt, "document.publishedAt")
  };
}

function objectPayload(value: unknown, source: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SupabaseRepositoryError(`Malformed Supabase RPC payload from ${source}`, source);
  }

  return value as Record<string, unknown>;
}

function arrayPayload(value: unknown, source: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new SupabaseRepositoryError(`Malformed Supabase RPC payload from ${source}`, source);
  }

  return value;
}

function stringPayload(value: unknown, source: string): string {
  if (typeof value !== "string") {
    throw new SupabaseRepositoryError(`Malformed Supabase RPC payload from ${source}`, source);
  }

  return value;
}

function nullableStringPayload(value: unknown, source: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;

  throw new SupabaseRepositoryError(`Malformed Supabase RPC payload from ${source}`, source);
}

function numberPayload(value: unknown, source: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;

  throw new SupabaseRepositoryError(`Malformed Supabase RPC payload from ${source}`, source);
}

function stringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is string => typeof item === "string");
}

function eligibilityFromJson(value: Json): Listing["eligibility"] {
  const objectValue = jsonObject(value);

  return {
    usable: booleanField(objectValue, "usable"),
    policyFit: booleanField(objectValue, "policyFit"),
    ownership: booleanField(objectValue, "ownership")
  };
}

function jsonObject(value: Json): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return value;
}

function booleanField(value: Record<string, Json | undefined>, key: string): boolean {
  return value[key] === true;
}

function agentFindings(value: Json): AgentFinding[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const objectValue = jsonObject(item);
    const severity = objectValue.severity;

    if (
      typeof objectValue.label !== "string" ||
      typeof objectValue.detail !== "string" ||
      (severity !== "info" && severity !== "warning" && severity !== "risk")
    ) {
      return [];
    }

    return [
      {
        label: objectValue.label,
        detail: objectValue.detail,
        severity
      }
    ];
  });
}

function agentAttachments(value: Json): AgentAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const objectValue = jsonObject(item);

    if (
      typeof objectValue.name !== "string" ||
      typeof objectValue.mime !== "string" ||
      typeof objectValue.sizeBytes !== "number"
    ) {
      return [];
    }

    return [
      {
        name: objectValue.name,
        mime: objectValue.mime,
        sizeBytes: objectValue.sizeBytes
      }
    ];
  });
}

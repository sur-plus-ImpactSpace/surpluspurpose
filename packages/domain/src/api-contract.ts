import type { UserRole } from "./model";
import type { SecurityControlId } from "./security-controls";

export type ApiRuntime = "next-route-handler" | "supabase-edge-function" | "webhook";
export type HttpMethod = "GET" | "POST" | "PATCH";
export type ApiActor = UserRole | "docuseal_webhook" | "stripe_webhook" | "anonymous";
export type ApiRateLimitPolicy = "read" | "mutation" | "strict" | "webhook";

export type ApiEndpointContract = {
  id: string;
  method: HttpMethod;
  path: string;
  runtime: ApiRuntime;
  actors: readonly ApiActor[];
  purpose: string;
  repositoryBoundary: string;
  requiresIdempotencyKey: boolean;
  requiresWebhookSignature: boolean;
  rateLimitPolicy: ApiRateLimitPolicy;
  securityControls: readonly SecurityControlId[];
  auditAction: string | null;
};

export const API_ENDPOINTS = [
  {
    id: "workspace.read",
    method: "GET",
    path: "/api/workspace",
    runtime: "next-route-handler",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Load the authenticated workspace shell from the repository boundary.",
    repositoryBoundary: "repo.snapshot scoped by ActorContext",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: false,
    rateLimitPolicy: "read",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "object-property-redaction",
      "secrets-out-of-browser"
    ],
    auditAction: null
  },
  {
    id: "matches.list",
    method: "GET",
    path: "/api/matches",
    runtime: "next-route-handler",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Return cursor-paginated matches visible to the actor.",
    repositoryBoundary: "repo.matches.list(actor)",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: false,
    rateLimitPolicy: "read",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "object-property-redaction"
    ],
    auditAction: null
  },
  {
    id: "matches.propose",
    method: "POST",
    path: "/api/matches",
    runtime: "next-route-handler",
    actors: ["admin"],
    purpose: "Ops pairs an open listing with an open need as a proposed match.",
    repositoryBoundary: "repo.matches.propose(actor, { listingId, needId })",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "match.proposed"
  },
  {
    id: "matches.fail",
    method: "POST",
    path: "/api/matches/:matchId/failure",
    runtime: "next-route-handler",
    actors: ["admin"],
    purpose: "Ops ends a shipped match as failed and decides whether the company's quota unit is refunded.",
    repositoryBoundary: "repo.matches.fail(actor, matchId, { ngoAtFault, reason })",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "match.failed"
  },
  {
    id: "matches.transition",
    method: "POST",
    path: "/api/matches/:matchId/transition",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Advance the canonical match state machine with actor guards.",
    repositoryBoundary: "repo.matches.transition(matchId, nextState, actor)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "match.transition"
  },
  {
    id: "messages.list",
    method: "GET",
    path: "/api/matches/:matchId/messages",
    runtime: "next-route-handler",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Read a cursor-paginated match thread within the visibility boundary.",
    repositoryBoundary: "repo.messages.listForMatch(matchId, actor)",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: false,
    rateLimitPolicy: "read",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "object-property-redaction"
    ],
    auditAction: null
  },
  {
    id: "messages.create",
    method: "POST",
    path: "/api/matches/:matchId/messages",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Create a customer-visible match message and fan it out via Realtime.",
    repositoryBoundary: "repo.messages.create(matchId, body, actor)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "mutation",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "message.created"
  },
  {
    id: "listings.create",
    method: "POST",
    path: "/api/listings",
    runtime: "supabase-edge-function",
    actors: ["corporate", "admin"],
    purpose: "Create surplus listings without consuming match quota.",
    repositoryBoundary: "repo.listings.create(actor, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail",
      "storage-signed-urls"
    ],
    auditAction: "listing.created"
  },
  {
    id: "donationCases.create",
    method: "POST",
    path: "/api/cases",
    runtime: "next-route-handler",
    actors: ["corporate", "admin", "editor"],
    purpose: "Create a donation case with contact, location and time window (REQ-CORP-01).",
    repositoryBoundary: "repo.donationCases.create(actor, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "donation_case.created"
  },
  {
    id: "donationPositions.create",
    method: "POST",
    path: "/api/cases/[caseId]/positions",
    runtime: "next-route-handler",
    actors: ["corporate", "admin", "editor"],
    purpose: "Add one position to a donation case (REQ-CORP-01).",
    repositoryBoundary: "repo.donationCases.addPosition(actor, caseId, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "donation_position.created"
  },
  {
    id: "donationPositions.import",
    method: "POST",
    path: "/api/cases/[caseId]/positions/import",
    runtime: "next-route-handler",
    actors: ["corporate", "admin", "editor"],
    purpose: "Import mapped CSV/Excel rows as donation positions (REQ-CORP-01).",
    repositoryBoundary: "repo.donationCases.importPositions(actor, caseId, positions)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "donation_positions.imported"
  },
  {
    id: "donationCases.confirm",
    method: "POST",
    path: "/api/cases/[caseId]/confirm",
    runtime: "next-route-handler",
    actors: ["corporate", "admin", "editor"],
    purpose: "Confirm donation case inventory before allocation (REQ-CORP-02).",
    repositoryBoundary: "repo.donationCases.confirm(actor, caseId)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "donation_case.confirmed"
  },
  {
    id: "donationAllocations.create",
    method: "POST",
    path: "/api/cases/[caseId]/allocations",
    runtime: "next-route-handler",
    actors: ["admin", "editor"],
    purpose: "Ops allocates a confirmed position quantity to one NGO (REQ-MATCH-09).",
    repositoryBoundary: "repo.donationAllocations.create(actor, caseId, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "donation_allocation.created"
  },
  {
    id: "donationAllocations.release",
    method: "POST",
    path: "/api/allocations/[allocationId]/release",
    runtime: "next-route-handler",
    actors: ["ngo", "admin", "editor"],
    purpose: "NGO written release of claim; frees quantity back to the pool (REQ-MATCH-09).",
    repositoryBoundary: "repo.donationAllocations.release(actor, allocationId, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "donation_allocation.released"
  },
  {
    id: "needs.create",
    method: "POST",
    path: "/api/needs",
    runtime: "supabase-edge-function",
    actors: ["ngo", "admin"],
    purpose: "Create NGO needs after verification-aware validation.",
    repositoryBoundary: "repo.needs.create(actor, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "need.created"
  },
  {
    id: "invitations.create",
    method: "POST",
    path: "/api/invitations",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Invite users within org visibility and plan seat limits.",
    repositoryBoundary: "repo.invitations.create(actor, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "invitation.created"
  },
  {
    id: "invitations.accept",
    method: "POST",
    path: "/api/invitations/accept",
    runtime: "next-route-handler",
    actors: ["corporate", "ngo"],
    purpose: "Accept a signed-in user's pending invitation and provision their workspace profile.",
    repositoryBoundary: "accept_invitation(token, fullName)",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-auth-required",
      "hashed-invitation-token",
      "email-bound-token-acceptance",
      "seat-limit-revalidation",
      "fail-closed-provisioning",
      "audit-trail"
    ],
    auditAction: "invitation.accepted"
  },
  {
    id: "companies.checkout",
    method: "POST",
    path: "/api/companies/:companyId/checkout",
    runtime: "next-route-handler",
    actors: ["corporate"],
    purpose: "A company starts buying Seed or Tree: returns a Stripe Checkout URL. The plan changes only via the signed webhook.",
    repositoryBoundary: "Stripe Checkout session (no plan change)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "secrets-out-of-browser"
    ],
    auditAction: "company.checkout_started"
  },
  {
    id: "stripe.webhook",
    method: "POST",
    path: "/api/stripe/webhook",
    runtime: "webhook",
    actors: ["stripe_webhook"],
    purpose: "Stripe confirms a paid checkout; the verified event activates the plan (idempotent per event id).",
    repositoryBoundary: "activate_company_plan_from_payment(company, plan, event) via the service role",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: true,
    rateLimitPolicy: "webhook",
    securityControls: ["signed-webhooks", "rate-limited-endpoints", "least-privilege-service-role", "audit-trail"],
    auditAction: "company.plan_paid"
  },
  {
    id: "co2Factors.set",
    method: "POST",
    path: "/api/co2-factors",
    runtime: "next-route-handler",
    actors: ["admin"],
    purpose: "Ops edits the CO2 factor (kg CO2e avoided per kg) of a goods category; impact reports use the current table.",
    repositoryBoundary: "repo.co2Factors.set(actor, { category, kgCo2ePerKg })",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "co2_factor.set"
  },
  {
    id: "accessRequests.submit",
    method: "POST",
    path: "/api/access-requests",
    runtime: "next-route-handler",
    actors: ["anonymous"],
    purpose: "Public lead capture: a visitor without an invitation asks for access.",
    repositoryBoundary: "submit_access_request(name, organization, role, email, phone, message)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: ["input-validation", "idempotent-mutations", "rate-limited-endpoints"],
    auditAction: "accessRequest.submitted"
  },
  {
    id: "admin.bootstrap",
    method: "POST",
    path: "/api/admin/bootstrap",
    runtime: "next-route-handler",
    actors: ["admin"],
    purpose: "Create the initial sur.plus admin workspace profile for an allowlisted Supabase Auth user.",
    repositoryBoundary: "service-role users insert after auth, email allowlist and bootstrap token checks",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-auth-required",
      "bootstrap-shared-secret",
      "least-privilege-service-role",
      "secrets-out-of-browser",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "admin.bootstrap"
  },
  {
    id: "agentRuns.create",
    method: "POST",
    path: "/api/agent-runs",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Create AI findings and proposed actions without executing them.",
    repositoryBoundary: "repo.agentRuns.create(actor, task)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "agent.run.created"
  },
  {
    id: "agentActions.approve",
    method: "POST",
    path: "/api/agent-actions/:actionId/approve",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Record explicit human approval for a proposed action.",
    repositoryBoundary: "repo.proposedActions.approve(actionId, actor)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "agent.action.approved"
  },
  {
    id: "agentActions.reject",
    method: "POST",
    path: "/api/agent-actions/:actionId/reject",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Reject a proposed action before it can execute.",
    repositoryBoundary: "repo.proposedActions.reject(actionId, actor)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "agent.action.rejected"
  },
  {
    id: "agentActions.execute",
    method: "POST",
    path: "/api/agent-actions/:actionId/execute",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Execute only an already-approved proposed action.",
    repositoryBoundary: "repo.proposedActions.execute(actionId, actor)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail"
    ],
    auditAction: "agent.action.executed"
  },
  {
    id: "documents.create",
    method: "POST",
    path: "/api/documents",
    runtime: "supabase-edge-function",
    actors: ["corporate", "ngo", "admin"],
    purpose: "Create document metadata after Storage upload validation.",
    repositoryBoundary: "repo.documents.create(actor, payload)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "input-validation",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail",
      "storage-signed-urls"
    ],
    auditAction: "document.created"
  },
  {
    id: "signatureEnvelopes.create",
    method: "POST",
    path: "/api/signature-envelopes",
    runtime: "supabase-edge-function",
    actors: ["admin"],
    purpose: "Create a DocuSeal envelope for an approved document.",
    repositoryBoundary: "repo.signatureEnvelopes.create(actor, documentId)",
    requiresIdempotencyKey: true,
    requiresWebhookSignature: false,
    rateLimitPolicy: "strict",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "idempotent-mutations",
      "rate-limited-endpoints",
      "audit-trail",
      "storage-signed-urls"
    ],
    auditAction: "signature.envelope.created"
  },
  {
    id: "docuseal.webhook",
    method: "POST",
    path: "/api/webhooks/docuseal",
    runtime: "webhook",
    actors: ["docuseal_webhook"],
    purpose: "Sync envelope and recipient status from DocuSeal only.",
    repositoryBoundary: "repo.signatureEnvelopes.applyWebhook(event)",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: true,
    rateLimitPolicy: "webhook",
    securityControls: [
      "signed-webhooks",
      "rate-limited-endpoints",
      "audit-trail",
      "security-event-monitoring"
    ],
    auditAction: "signature.webhook.synced"
  },
  {
    id: "reports.csrd",
    method: "GET",
    path: "/api/reports/csrd",
    runtime: "next-route-handler",
    actors: ["corporate"],
    purpose: "Export the company's complete CSRD/ESRS report for a chosen period (html or csv), verified companies only.",
    repositoryBoundary: "buildImpactReport over repo.matches.list(actor) with a period",
    requiresIdempotencyKey: false,
    requiresWebhookSignature: false,
    rateLimitPolicy: "read",
    securityControls: [
      "zero-trust-per-request-authz",
      "supabase-rls-object-authorization",
      "object-property-redaction",
      "storage-signed-urls"
    ],
    auditAction: null
  }
] as const satisfies readonly ApiEndpointContract[];

export function mutationApiEndpoints(): readonly ApiEndpointContract[] {
  return API_ENDPOINTS.filter((endpoint) => endpoint.method !== "GET");
}

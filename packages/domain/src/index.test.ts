import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AGENT_RUN_IDEMPOTENCY_HEADER,
  AGENT_RUN_STATUSES,
  AGENT_ACTION_IDEMPOTENCY_HEADER,
  AGENT_ACTION_OPERATIONS,
  AGENT_TASK_TYPES,
  AGENT_TARGET_TYPES,
  API_ENDPOINTS,
  CONTACT_UNLOCK_STATES,
  IDEMPOTENCY_STATUSES,
  INVITATION_DELIVERY_OPERATIONS,
  INVITATION_DELIVERY_STATUSES,
  INVITATION_IDEMPOTENCY_HEADER,
  INVITATION_OPERATIONS,
  INVITATION_STATUSES,
  LISTING_STATES,
  MATCH_STATES,
  MESSAGE_IDEMPOTENCY_HEADER,
  NEED_STATES,
  NGO_VERIFICATION_STATES,
  PAID_PLAN_TIERS,
  PLAN_ENTITLEMENTS,
  PLAN_TIERS,
  isPaidPlan,
  PROPOSED_ACTION_STATUSES,
  RATE_LIMIT_POLICIES,
  SECURITY_BASELINE,
  SECURITY_CONTROL_IDS,
  acceptInvitationWithSupabaseRpc,
  createInvitationWithSupabaseRpc,
  createAgentRunWithSupabaseRpc,
  createMessageWithSupabaseRpc,
  createSupabaseRestRepository,
  createInMemoryRepository,
  createIdempotencyRequestHash,
  createSeedData,
  fetchOpenNeedsDirectoryWithSupabase,
  completeLocalIdempotency,
  failLocalIdempotency,
  idempotencyFailureHttp,
  loadRepositoryDataFromSupabaseRest,
  mutationApiEndpoints,
  parseAgentRunCommand,
  parseAgentActionCommand,
  parseInvitationAcceptanceCommand,
  parseInvitationCommand,
  parseInvitationMutationCommand,
  parseMessageCommand,
  performAgentActionWithSupabaseRpc,
  recordInvitationDeliveryAttemptWithSupabaseRpc,
  resendInvitationWithSupabaseRpc,
  revokeInvitationWithSupabaseRpc,
  reserveLocalRateLimit,
  reserveLocalIdempotency,
  unlocksContact
} from "./index";

const admin = { role: "admin", userId: "usr-admin-ops" } as const;
const corporateAcme = {
  role: "corporate",
  userId: "usr-corporate-acme",
  companyId: "co-acme"
} as const;
const ngoKleiderkammer = {
  role: "ngo",
  userId: "usr-ngo-kleiderkammer",
  ngoId: "ngo-kleiderkammer"
} as const;

describe("platform invariants", () => {
  it("keeps one canonical match state machine", () => {
    expect(MATCH_STATES).toEqual([
      "proposed",
      "ngo_confirmed",
      "both_confirmed",
      "in_transit",
      "delivered",
      "completed",
      "cancelled",
      "expired",
      "failed"
    ]);
  });

  it("unlocks contact data only from both_confirmed onward", () => {
    expect(unlocksContact("proposed")).toBe(false);
    expect(unlocksContact("ngo_confirmed")).toBe(false);
    expect(CONTACT_UNLOCK_STATES.every(unlocksContact)).toBe(true);
  });

  it("models platform plans on matches per year, not listing counts", () => {
    expect(PLAN_ENTITLEMENTS.seed.matchesPerYear).toBe(12);
    expect(PLAN_ENTITLEMENTS.tree.matchesPerYear).toBeNull();
    expect(PLAN_ENTITLEMENTS.seed.userSeats).toBe(2);
    expect(PLAN_ENTITLEMENTS.tree.userSeats).toBe(5);
  });

  it("lets registered corporates browse but not act", () => {
    // The landing page's Matching Engine already publishes need + NGO name to
    // anyone, so browsing is free. Reaching the NGO and matching is not.
    expect(PLAN_ENTITLEMENTS.registered.ngoContactAccess).toBe(false);
    expect(PLAN_ENTITLEMENTS.registered.matchesPerYear).toBe(0);
    expect(PLAN_ENTITLEMENTS.registered.matchingMode).toBe("none");
    // They can still log in — registering has to lead somewhere.
    expect(PLAN_ENTITLEMENTS.registered.platformAccess).toBe(true);
  });

  it("keeps contact access on paid tiers only", () => {
    expect(PAID_PLAN_TIERS.every((plan) => PLAN_ENTITLEMENTS[plan].ngoContactAccess)).toBe(true);
    expect(isPaidPlan("registered")).toBe(false);
    expect(isPaidPlan("seed")).toBe(true);
    expect(isPaidPlan("tree")).toBe(true);
  });

  it("orders plan tiers from unpaid to richest so registered is the floor", () => {
    expect(PLAN_TIERS).toEqual(["registered", "seed", "tree"]);
  });

  it("keeps one canonical invitation lifecycle", () => {
    expect(INVITATION_STATUSES).toEqual(["pending", "accepted", "expired", "revoked"]);
  });

  it("keeps one canonical invitation delivery attempt model", () => {
    expect(INVITATION_DELIVERY_OPERATIONS).toEqual(["create", "resend"]);
    expect(INVITATION_DELIVERY_STATUSES).toEqual(["sent", "skipped", "failed"]);
  });

  it("keeps one canonical idempotency lifecycle", () => {
    expect(IDEMPOTENCY_STATUSES).toEqual(["processing", "completed", "failed"]);
  });

  it("keeps one canonical agent approval loop", () => {
    expect(AGENT_RUN_STATUSES).toEqual([
      "queued",
      "needs_approval",
      "approved",
      "completed",
      "rejected"
    ]);
    expect(PROPOSED_ACTION_STATUSES).toEqual([
      "pending",
      "approved",
      "rejected",
      "executed"
    ]);
  });

  it("keeps one canonical set of agent task types", () => {
    expect(AGENT_TASK_TYPES).toEqual([
      "match_review",
      "message_draft",
      "social_ad",
      "ops_summary",
      "surplus_intake"
    ]);
    expect(AGENT_TARGET_TYPES).toEqual(["match", "listing", "document"]);
  });

  it("keeps production API mutations protected by idempotency or webhook signatures", () => {
    const mutations = mutationApiEndpoints();

    expect(API_ENDPOINTS.some((endpoint) => endpoint.id === "docuseal.webhook")).toBe(true);
    expect(mutations.length).toBeGreaterThan(0);
    expect(mutations.every((endpoint) => endpoint.auditAction)).toBe(true);
    expect(mutations.every((endpoint) => endpoint.rateLimitPolicy !== "read")).toBe(true);
    expect(
      mutations.every(
        (endpoint) =>
          endpoint.requiresIdempotencyKey ||
          endpoint.requiresWebhookSignature ||
          endpoint.securityControls.includes("hashed-invitation-token") ||
          endpoint.securityControls.includes("bootstrap-shared-secret")
      )
    ).toBe(true);
  });

  it("keeps every API endpoint mapped to known security controls", () => {
    const knownControlIds = new Set(SECURITY_CONTROL_IDS);
    const hasActor = (actors: readonly string[], actor: string) => actors.includes(actor);
    const hasControl = (controls: readonly string[], control: string) => controls.includes(control);

    expect(SECURITY_BASELINE).toHaveLength(SECURITY_CONTROL_IDS.length);
    expect(
      API_ENDPOINTS.every((endpoint) => endpoint.securityControls.every((control) => knownControlIds.has(control)))
    ).toBe(true);
    expect(
      API_ENDPOINTS.filter((endpoint) => hasActor(endpoint.actors, "docuseal_webhook") || hasActor(endpoint.actors, "stripe_webhook")).every(
        (endpoint) =>
          endpoint.requiresWebhookSignature &&
          hasControl(endpoint.securityControls, "signed-webhooks") &&
          endpoint.rateLimitPolicy === "webhook"
      )
    ).toBe(true);
    expect(
      // Signed-in endpoints authorize every request; the only public one is the
      // "Request access" form, which has no session to authorize.
      API_ENDPOINTS.filter(
        (endpoint) =>
          !hasActor(endpoint.actors, "docuseal_webhook") &&
          !hasActor(endpoint.actors, "stripe_webhook") &&
          !hasActor(endpoint.actors, "anonymous")
      ).every((endpoint) => hasControl(endpoint.securityControls, "zero-trust-per-request-authz"))
    ).toBe(true);
  });

  it("keeps browser hardening headers configured for the Next app", () => {
    const nextConfig = readFileSync(new URL("../../../apps/web/next.config.mjs", import.meta.url), "utf8");
    const proxy = readFileSync(new URL("../../../apps/web/proxy.ts", import.meta.url), "utf8");

    [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Permissions-Policy",
      "Referrer-Policy"
    ].forEach((snippet) => {
      expect(nextConfig).toContain(snippet);
    });
    [
      "Content-Security-Policy",
      "nonce-",
      "strict-dynamic",
      "frame-ancestors 'none'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co"
    ].forEach((snippet) => {
      expect(proxy).toContain(snippet);
    });
  });

  it("keeps scale-critical indexes in the initial migration", () => {
    const migration = readFileSync(
      new URL("../../../supabase/migrations/0001_initial_schema.sql", import.meta.url),
      "utf8"
    );

    [
      "create index users_company_role_idx on users (company_id, role)",
      "create index users_ngo_role_idx on users (ngo_id, role)",
      "create index invitations_company_status_idx on invitations (company_id, status, created_at)",
      "create unique index idempotency_actor_endpoint_key_idx on idempotency_keys (actor_id, endpoint_id, key)",
      "constraint idempotency_completed_has_response check",
      "create or replace function reserve_idempotency_key",
      "create or replace function complete_idempotency_key",
      "create policy users_workspace_visible on users for select",
      "create or replace function create_invitation",
      "create or replace function accept_invitation",
      "create or replace function resend_invitation",
      "create or replace function revoke_invitation",
      "create table invitation_delivery_attempts",
      "create index invitation_delivery_attempts_invitation_created_idx",
      "create or replace function record_invitation_delivery_attempt",
      "create or replace function create_message",
      "create or replace function create_agent_run",
      "create or replace function perform_agent_action",
      "create or replace function sync_agent_run_status",
      "raise exception 'seat_limit_exceeded'",
      "grant execute on function reserve_idempotency_key(text, text, text) to authenticated",
      "create unique index invitations_acceptance_token_hash_idx on invitations (acceptance_token_hash)",
      "grant execute on function create_invitation(text, user_role, uuid, uuid, text, date, text) to authenticated",
      "grant execute on function accept_invitation(text, text) to authenticated",
      "grant execute on function resend_invitation(uuid, text) to authenticated",
      "grant execute on function revoke_invitation(uuid) to authenticated",
      "grant execute on function record_invitation_delivery_attempt(uuid, invitation_delivery_operation, text, invitation_delivery_status, text, text, text) to authenticated",
      "create policy invitation_delivery_attempts_visible on invitation_delivery_attempts for select",
      "grant execute on function create_message(text, text) to authenticated",
      "grant execute on function create_agent_run(text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated",
      "grant execute on function perform_agent_action(text, text) to authenticated",
      "create index listings_company_state_idx on listings (company_id, state, created_at)",
      "create index needs_ngo_state_idx on needs (ngo_id, state, created_at)",
      "create index matches_state_created_idx on matches (state, created_at)",
      "create index messages_match_created_idx on messages (match_id, created_at)",
      "create index agent_runs_company_status_idx on agent_runs (company_id, status, created_at)",
      "create index documents_company_status_idx on documents (company_id, status, created_at)",
      "create unique index signature_envelopes_external_id_idx on signature_envelopes (provider, external_id)"
    ].forEach((snippet) => {
      expect(migration).toContain(snippet);
    });
  });
});

describe("agent-run API command boundary", () => {
  const headers = new Headers({ [AGENT_RUN_IDEMPOTENCY_HEADER]: "agent-run-001" });

  it("requires an idempotency key for agent-run mutations", () => {
    expect(
      parseAgentRunCommand(new Headers(), {
        taskType: "match_review",
        targetType: "match",
        targetId: "mat-thinkpads",
        prompt: "Draft a reviewed next step."
      })
    ).toEqual({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("rejects malformed agent-run payloads before repository execution", () => {
    expect(
      parseAgentRunCommand(headers, {
        taskType: "social_ad",
        targetType: "match",
        targetId: "mat-thinkpads",
        prompt: "Draft social copy.",
        attachments: [{ name: "impact.pdf", mime: "application/pdf", sizeBytes: "large" }]
      })
    ).toEqual({
      ok: false,
      reason: "invalid_payload",
      status: 400
    });
  });

  it("normalizes valid agent-run commands for the repository boundary", () => {
    const command = parseAgentRunCommand(headers, {
      taskType: "social_ad",
      title: " LinkedIn reuse draft ",
      targetType: "match",
      targetId: " mat-thinkpads ",
      prompt: " Draft a social post for review. ",
      attachments: [{ name: " impact.pdf ", mime: " application/pdf ", sizeBytes: 1200 }]
    });

    expect(command.ok).toBe(true);
    if (!command.ok) return;

    expect(command.command).toEqual({
      idempotencyKey: "agent-run-001",
      input: {
        taskType: "social_ad",
        title: "LinkedIn reuse draft",
        targetType: "match",
        targetId: "mat-thinkpads",
        prompt: "Draft a social post for review.",
        attachments: [{ name: "impact.pdf", mime: "application/pdf", sizeBytes: 1200 }]
      }
    });
  });
});

describe("agent-action API command boundary", () => {
  const headers = new Headers({ [AGENT_ACTION_IDEMPOTENCY_HEADER]: "agent-action-001" });

  it("keeps one canonical set of agent action operations", () => {
    expect(AGENT_ACTION_OPERATIONS).toEqual(["approve", "reject", "execute"]);
  });

  it("requires an idempotency key for agent action mutations", () => {
    expect(
      parseAgentActionCommand(new Headers(), {
        actionId: "act-draft-ngo-message",
        operation: "approve"
      })
    ).toEqual({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("rejects malformed agent action commands before repository execution", () => {
    expect(
      parseAgentActionCommand(headers, {
        actionId: "act-draft-ngo-message",
        operation: "publish"
      })
    ).toEqual({
      ok: false,
      reason: "invalid_operation",
      status: 422
    });
    expect(
      parseAgentActionCommand(headers, {
        actionId: "   ",
        operation: "approve"
      })
    ).toEqual({
      ok: false,
      reason: "invalid_action_id",
      status: 400
    });
  });

  it("normalizes valid agent action commands", () => {
    expect(
      parseAgentActionCommand(headers, {
        actionId: " act-draft-ngo-message ",
        operation: "execute"
      })
    ).toEqual({
      ok: true,
      command: {
        idempotencyKey: "agent-action-001",
        actionId: "act-draft-ngo-message",
        operation: "execute"
      }
    });
  });
});

describe("message API command boundary", () => {
  const headers = new Headers({ [MESSAGE_IDEMPOTENCY_HEADER]: "message-001" });

  it("requires an idempotency key for message mutations", () => {
    expect(parseMessageCommand(new Headers(), { matchId: "mat-thinkpads", body: "Hello" })).toEqual({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("rejects malformed message commands before repository execution", () => {
    expect(parseMessageCommand(headers, { matchId: "", body: "Hello" })).toEqual({
      ok: false,
      reason: "invalid_match_id",
      status: 400
    });
    expect(parseMessageCommand(headers, { matchId: "mat-thinkpads", body: "   " })).toEqual({
      ok: false,
      reason: "empty_body",
      status: 422
    });
    expect(parseMessageCommand(headers, { matchId: "mat-thinkpads", body: "x".repeat(2001) })).toEqual({
      ok: false,
      reason: "body_too_long",
      status: 413
    });
  });

  it("normalizes valid message commands", () => {
    expect(parseMessageCommand(headers, { matchId: " mat-thinkpads ", body: "  Can we confirm pickup? " })).toEqual({
      ok: true,
      command: {
        idempotencyKey: "message-001",
        matchId: "mat-thinkpads",
        body: "Can we confirm pickup?"
      }
    });
  });
});

describe("invitation API command boundary", () => {
  const headers = new Headers({ [INVITATION_IDEMPOTENCY_HEADER]: "invite-001" });

  it("keeps the invitation operation set deliberately small", () => {
    expect(INVITATION_OPERATIONS).toEqual(["revoke", "resend"]);
  });

  it("requires an idempotency key for invitation mutations", () => {
    expect(
      parseInvitationCommand(new Headers(), {
        email: "ops@acme.example",
        role: "corporate"
      })
    ).toEqual({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("rejects malformed invitation payloads before repository execution", () => {
    expect(
      parseInvitationCommand(headers, {
        email: "ops@acme.example",
        role: "admin"
      })
    ).toEqual({
      ok: false,
      reason: "invalid_invitation",
      status: 422
    });
  });

  it("normalizes valid invitation commands for the repository boundary", () => {
    const command = parseInvitationCommand(headers, {
      email: " OPS@ACME.EXAMPLE ",
      role: "corporate",
      companyId: " co-acme ",
      orgName: " Acme GmbH ",
      expiresAt: " 2026-07-01 "
    });

    expect(command.ok).toBe(true);
    if (!command.ok) return;

    expect(command.command).toEqual({
      idempotencyKey: "invite-001",
      input: {
        email: "ops@acme.example",
        role: "corporate",
        companyId: "co-acme",
        ngoId: undefined,
        orgName: "Acme GmbH",
        expiresAt: "2026-07-01"
      }
    });
  });

  it("normalizes invitation mutation commands before repository execution", () => {
    expect(
      parseInvitationMutationCommand(new Headers({ [INVITATION_IDEMPOTENCY_HEADER]: "invite-revoke-001" }), {
        invitationId: " inv-acme-ops ",
        operation: "revoke"
      })
    ).toEqual({
      ok: true,
      command: {
        idempotencyKey: "invite-revoke-001",
        invitationId: "inv-acme-ops",
        operation: "revoke"
      }
    });
    expect(
      parseInvitationMutationCommand(new Headers(), {
        invitationId: "inv-acme-ops",
        operation: "revoke"
      })
    ).toEqual({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("validates invitation acceptance tokens before provisioning", () => {
    expect(parseInvitationAcceptanceCommand({ token: "short" })).toEqual({
      ok: false,
      reason: "invalid_invitation_token",
      status: 422
    });

    expect(
      parseInvitationAcceptanceCommand({
        token: ` ${"a".repeat(43)} `,
        fullName: " Lena Ops "
      })
    ).toEqual({
      ok: true,
      command: {
        token: "a".repeat(43),
        fullName: "Lena Ops"
      }
    });
  });
});

describe("idempotency contract", () => {
  it("hashes equivalent request bodies to the same value", async () => {
    const first = await createIdempotencyRequestHash({
      actorId: "usr-corporate-acme",
      endpointId: "invitations.create",
      body: {
        role: "corporate",
        email: "ops@acme.example",
        nested: { b: 2, a: 1 }
      }
    });
    const second = await createIdempotencyRequestHash({
      actorId: "usr-corporate-acme",
      endpointId: "invitations.create",
      body: {
        nested: { a: 1, b: 2 },
        email: "ops@acme.example",
        role: "corporate"
      }
    });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("hashes changed request bodies to a different value", async () => {
    const first = await createIdempotencyRequestHash({
      actorId: "usr-corporate-acme",
      endpointId: "agentRuns.create",
      body: { taskType: "social_ad", prompt: "Draft A" }
    });
    const second = await createIdempotencyRequestHash({
      actorId: "usr-corporate-acme",
      endpointId: "agentRuns.create",
      body: { taskType: "social_ad", prompt: "Draft B" }
    });

    expect(first).not.toBe(second);
  });

  it("replays completed local idempotency reservations", () => {
    const store = new Map();
    const input = {
      actorId: "usr-corporate-acme",
      endpointId: "invitations.create",
      idempotencyKey: "invite-001",
      requestHash: "hash-001"
    };

    expect(reserveLocalIdempotency(store, input)).toEqual({ state: "reserved" });
    expect(
      completeLocalIdempotency(store, {
        ...input,
        responseStatus: 201,
        responseBody: { invitationId: "inv-001" },
        resourceType: "invitation",
        resourceId: "inv-001"
      })
    ).toBe(true);

    expect(reserveLocalIdempotency(store, input)).toEqual({
      state: "replay",
      responseStatus: 201,
      responseBody: { invitationId: "inv-001" },
      resourceType: "invitation",
      resourceId: "inv-001"
    });
  });

  it("blocks reused idempotency keys with different request bodies", () => {
    const store = new Map();
    const input = {
      actorId: "usr-corporate-acme",
      endpointId: "agentRuns.create",
      idempotencyKey: "agent-run-001",
      requestHash: "hash-001"
    };

    expect(reserveLocalIdempotency(store, input)).toEqual({ state: "reserved" });
    expect(
      reserveLocalIdempotency(store, {
        ...input,
        requestHash: "hash-002"
      })
    ).toEqual({ state: "conflict" });
    expect(idempotencyFailureHttp("conflict")).toEqual({
      reason: "idempotency_key_conflict",
      status: 409
    });
  });

  it("marks local reservations failed when execution cannot complete", () => {
    const store = new Map();
    const input = {
      actorId: "usr-corporate-acme",
      endpointId: "agentRuns.create",
      idempotencyKey: "agent-run-002",
      requestHash: "hash-001"
    };

    expect(reserveLocalIdempotency(store, input)).toEqual({ state: "reserved" });
    expect(failLocalIdempotency(store, input)).toBe(true);
    expect(reserveLocalIdempotency(store, input)).toEqual({ state: "failed" });
    expect(idempotencyFailureHttp("failed")).toEqual({
      reason: "idempotency_key_failed",
      status: 409
    });
  });
});

describe("rate-limit contract", () => {
  it("keeps every API rate-limit policy configured", () => {
    expect(Object.keys(RATE_LIMIT_POLICIES).sort()).toEqual([
      "mutation",
      "read",
      "strict",
      "webhook"
    ]);
  });

  it("blocks strict mutations after the configured window budget", () => {
    const store = new Map();
    const input = {
      actorId: "usr-corporate-acme",
      endpointId: "agentRuns.create",
      policy: "strict" as const,
      now: 1_000
    };

    for (let index = 0; index < RATE_LIMIT_POLICIES.strict.maxRequests; index += 1) {
      const result = reserveLocalRateLimit(store, input);
      expect(result.ok).toBe(true);
    }

    expect(reserveLocalRateLimit(store, input)).toEqual({
      ok: false,
      limit: RATE_LIMIT_POLICIES.strict.maxRequests,
      retryAfterSeconds: 60,
      resetAt: 61_000
    });
  });

  it("resets local rate limits when the policy window expires", () => {
    const store = new Map();
    const input = {
      actorId: "usr-corporate-acme",
      endpointId: "invitations.create",
      policy: "strict" as const,
      now: 1_000
    };

    for (let index = 0; index < RATE_LIMIT_POLICIES.strict.maxRequests; index += 1) {
      reserveLocalRateLimit(store, input);
    }

    expect(
      reserveLocalRateLimit(store, {
        ...input,
        now: 61_000
      })
    ).toMatchObject({
      ok: true,
      limit: RATE_LIMIT_POLICIES.strict.maxRequests,
      remaining: RATE_LIMIT_POLICIES.strict.maxRequests - 1,
      resetAt: 121_000
    });
  });
});

describe("in-memory repository seam", () => {
  it("keeps seed data referentially valid", () => {
    const repo = createInMemoryRepository();

    expect(repo.assertReferentialIntegrity()).toEqual([]);
  });

  it("applies required E1 data cleanup", () => {
    const data = createSeedData();

    expect(data.listings.every((listing) => LISTING_STATES.includes(listing.state))).toBe(true);
    expect(data.needs.every((need) => NEED_STATES.includes(need.state))).toBe(true);
    expect(data.ngos.every((ngo) => NGO_VERIFICATION_STATES.includes(ngo.verificationState))).toBe(true);
    expect(data.listings.some((listing) => String(listing.state) === "match_proposed")).toBe(false);
    expect(data.listings.some((listing) => String(listing.state) === "review")).toBe(false);
    expect(data.needs.some((need) => String(need.state) === "active")).toBe(false);
    expect(data.ngos.some((ngo) => String(ngo.verificationState) === "pending")).toBe(false);
    expect(
      data.matches.every(
        (match) => !("status" in match) && !("logisticsStatus" in match) && !("certificateStatus" in match)
      )
    ).toBe(true);
  });

  it("lists active workspace members within the actor boundary", () => {
    const repo = createInMemoryRepository();

    expect(repo.users.list(corporateAcme).map((user) => user.id)).toEqual(["usr-corporate-acme"]);
    expect(repo.users.list(ngoKleiderkammer).map((user) => user.id)).toEqual(["usr-ngo-kleiderkammer"]);
    expect(repo.users.list(admin).map((user) => user.id)).toEqual([
      "usr-corporate-acme",
      "usr-ngo-kleiderkammer",
      "usr-admin-ops",
      "usr-editor-ops"
    ]);
  });

  it("verifies an NGO application on admin approval and stamps verifiedAt", () => {
    const repo = createInMemoryRepository();

    const result = repo.ngos.setVerification(
      "ngo-tafel",
      { action: "approve", proofNoticeDate: "2024-06-01", proofAssessmentPeriodYears: 5 },
      admin
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ngo.verificationState).toBe("verified");
      expect(result.ngo.verifiedAt).not.toBeNull();
      expect(result.ngo.proofValidUntil).toBe("2029-06-01");
    }
  });

  it("sends an NGO back for more info and clears verifiedAt on request_info", () => {
    const repo = createInMemoryRepository();

    const result = repo.ngos.setVerification("ngo-kleiderkammer", "request_info", admin);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ngo.verificationState).toBe("pending_info");
      expect(result.ngo.verifiedAt).toBeNull();
    }
  });

  it("blocks NGO verification for non-admin actors and unknown NGOs", () => {
    const repo = createInMemoryRepository();

    expect(repo.ngos.setVerification("ngo-tafel", "approve", corporateAcme)).toEqual({
      ok: false,
      reason: "actor_not_allowed"
    });
    expect(repo.ngos.setVerification("ngo-missing", "approve", admin)).toEqual({
      ok: false,
      reason: "ngo_not_found"
    });
  });

  it("lists all NGOs for admin and none for other roles", () => {
    const repo = createInMemoryRepository();

    expect(repo.ngos.listForAdmin(admin).length).toBeGreaterThan(0);
    expect(repo.ngos.listForAdmin(corporateAcme)).toEqual([]);
  });

  it("enforces match transitions with actor guards and side effects", () => {
    const repo = createInMemoryRepository();

    expect(repo.matches.transition("mat-thinkpads", "both_confirmed", corporateAcme)).toEqual({
      ok: false,
      reason: "invalid_transition"
    });

    const ngoResult = repo.matches.transition("mat-thinkpads", "ngo_confirmed", ngoKleiderkammer);
    expect(ngoResult.ok).toBe(true);
    expect(repo.needs.get("need-laptops")?.state).toBe("matched");

    const corporateResult = repo.matches.transition("mat-thinkpads", "both_confirmed", corporateAcme);
    expect(corporateResult.ok).toBe(true);
    expect(repo.matches.get("mat-thinkpads")?.state).toBe("both_confirmed");
    expect(repo.listings.get("lst-thinkpads")?.state).toBe("confirmed");
    expect(repo.companies.countCommittedMatches("co-acme", 2026)).toBe(1);
  });

  it("blocks Seed from committing the 13th match in a contract year", () => {
    const data = createSeedData();
    for (let index = 0; index < 12; index += 1) {
      data.matches.push({
        id: `mat-seed-committed-${index + 1}`,
        listingId: "lst-thinkpads",
        needId: "need-laptops",
        state: "completed",
        quantity: 1,
        committedAt: "2026-03-01T09:00:00.000Z",
        quotaRefundedAt: null,
        score: 90,
        co2Tons: 1,
        pickupDate: null,
        deliveryDate: null,
        carrier: null,
        trackingRef: null,
        createdAt: `2026-02-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`
      });
    }
    const repo = createInMemoryRepository(data);

    expect(repo.matches.transition("mat-thinkpads", "ngo_confirmed", ngoKleiderkammer).ok).toBe(true);
    expect(repo.matches.transition("mat-thinkpads", "both_confirmed", corporateAcme)).toEqual({
      ok: false,
      reason: "match_quota_exceeded"
    });
    expect(repo.matches.get("mat-thinkpads")?.state).toBe("ngo_confirmed");
    expect(repo.companies.countCommittedMatches("co-acme", 2026)).toBe(12);
  });

  it("keeps Tree uncapped for committed matches", () => {
    const data = createSeedData();
    data.users.push({
      id: "usr-corporate-hanse",
      email: "hanse@sur.plus.demo",
      fullName: "Mika Brandt",
      role: "corporate",
      companyId: "co-hanse",
      ngoId: null,
      createdAt: "2026-01-12T09:00:00.000Z"
    });
    for (let index = 0; index < 20; index += 1) {
      data.matches.push({
        id: `mat-tree-committed-${index + 1}`,
        listingId: "lst-jackets",
        needId: "need-jackets",
        state: "completed",
        quantity: 1,
        committedAt: "2026-03-01T09:00:00.000Z",
        quotaRefundedAt: null,
        score: 88,
        co2Tons: 1,
        pickupDate: null,
        deliveryDate: null,
        carrier: null,
        trackingRef: null,
        createdAt: `2026-03-${String(index + 1).padStart(2, "0")}T09:00:00.000Z`
      });
    }
    data.matches.push({
      id: "mat-tree-next",
      listingId: "lst-jackets",
      needId: "need-jackets",
      state: "ngo_confirmed",
      quantity: 1,
      committedAt: "2026-03-01T09:00:00.000Z",
      quotaRefundedAt: null,
      score: 87,
      co2Tons: 1,
      pickupDate: null,
      deliveryDate: null,
      carrier: null,
      trackingRef: null,
      createdAt: "2026-06-10T09:00:00.000Z"
    });
    const repo = createInMemoryRepository(data);
    const corporateHanse = {
      role: "corporate",
      userId: "usr-corporate-hanse",
      companyId: "co-hanse"
    } as const;

    expect(repo.companies.countCommittedMatches("co-hanse", 2026)).toBeGreaterThan(12);
    expect(repo.matches.transition("mat-tree-next", "both_confirmed", corporateHanse).ok).toBe(true);
    expect(repo.matches.get("mat-tree-next")?.state).toBe("both_confirmed");
  });

  it("enforces Seed seats across active users and pending invitations", () => {
    const repo = createInMemoryRepository();

    const firstInvite = repo.invitations.create(corporateAcme, {
      email: "ops-one@acme.example",
      role: "corporate"
    });
    expect(firstInvite.ok).toBe(true);
    expect(firstInvite.ok && firstInvite.invitation).toMatchObject({
      email: "ops-one@acme.example",
      role: "corporate",
      companyId: "co-acme",
      status: "pending"
    });

    expect(
      repo.invitations.create(corporateAcme, {
        email: "ops-two@acme.example",
        role: "corporate"
      })
    ).toEqual({
      ok: false,
      reason: "seat_limit_exceeded"
    });
    expect(repo.invitations.list(corporateAcme)).toHaveLength(1);
    expect(repo.auditEvents.list().some((event) => event.action === "invitation.created")).toBe(true);
  });

  it("revokes pending invitations and frees the pending seat", () => {
    const repo = createInMemoryRepository();

    const firstInvite = repo.invitations.create(corporateAcme, {
      email: "ops-one@acme.example",
      role: "corporate"
    });
    expect(firstInvite.ok).toBe(true);
    if (!firstInvite.ok) return;

    expect(repo.invitations.revoke(corporateAcme, firstInvite.invitation.id)).toMatchObject({
      ok: true,
      invitation: {
        id: firstInvite.invitation.id,
        status: "revoked"
      }
    });
    expect(repo.invitations.revoke(corporateAcme, firstInvite.invitation.id)).toEqual({
      ok: false,
      reason: "invitation_not_pending"
    });
    expect(
      repo.invitations.create(corporateAcme, {
        email: "ops-two@acme.example",
        role: "corporate"
      }).ok
    ).toBe(true);
    expect(repo.auditEvents.list().some((event) => event.action === "invitation.revoked")).toBe(true);
  });

  it("resends pending invitations without changing status or scope", () => {
    const repo = createInMemoryRepository();

    const invite = repo.invitations.create(ngoKleiderkammer, {
      email: "logistics-two@kleiderkammer.example",
      role: "ngo"
    });
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;

    expect(repo.invitations.resend(ngoKleiderkammer, invite.invitation.id)).toMatchObject({
      ok: true,
      invitation: {
        id: invite.invitation.id,
        ngoId: "ngo-kleiderkammer",
        status: "pending"
      }
    });
    expect(repo.auditEvents.list().some((event) => event.action === "invitation.resent")).toBe(true);
  });

  it("records invitation delivery attempts inside the actor boundary", () => {
    const repo = createInMemoryRepository();

    const invite = repo.invitations.create(ngoKleiderkammer, {
      email: "delivery@kleiderkammer.example",
      role: "ngo"
    });
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;

    const delivery = repo.invitationDeliveries.record(ngoKleiderkammer, {
      invitationId: invite.invitation.id,
      operation: "resend",
      provider: "resend",
      status: "sent",
      messageId: "msg-123"
    });

    expect(delivery).toMatchObject({
      ok: true,
      attempt: {
        actorId: "usr-ngo-kleiderkammer",
        invitationId: invite.invitation.id,
        messageId: "msg-123",
        operation: "resend",
        provider: "resend",
        status: "sent"
      }
    });
    expect(repo.invitationDeliveries.listForInvitation(ngoKleiderkammer, invite.invitation.id)).toHaveLength(1);
    expect(repo.invitationDeliveries.list(corporateAcme)).toHaveLength(0);
    expect(repo.auditEvents.list().some((event) => event.action === "invitation.delivery.sent")).toBe(true);
  });

  it("blocks invitations outside the actor organization boundary", () => {
    const repo = createInMemoryRepository();

    expect(
      repo.invitations.create(corporateAcme, {
        email: "outsider@hanse.example",
        role: "corporate",
        companyId: "co-hanse"
      })
    ).toEqual({
      ok: false,
      reason: "actor_not_allowed"
    });
  });

  it("keeps Tree seats higher than Seed but still enforced", () => {
    const data = createSeedData();
    data.users.push({
      id: "usr-corporate-hanse",
      email: "hanse@sur.plus.demo",
      fullName: "Mika Brandt",
      role: "corporate",
      companyId: "co-hanse",
      ngoId: null,
      createdAt: "2026-01-12T09:00:00.000Z"
    });
    const repo = createInMemoryRepository(data);
    const corporateHanse = {
      role: "corporate",
      userId: "usr-corporate-hanse",
      companyId: "co-hanse"
    } as const;

    for (let index = 0; index < 4; index += 1) {
      expect(
        repo.invitations.create(corporateHanse, {
          email: `seat-${index + 1}@hanse.example`,
          role: "corporate"
        }).ok
      ).toBe(true);
    }

    expect(
      repo.invitations.create(corporateHanse, {
        email: "seat-5@hanse.example",
        role: "corporate"
      })
    ).toEqual({
      ok: false,
      reason: "seat_limit_exceeded"
    });
  });

  it("keeps NGO contact details locked until both sides confirm", () => {
    const repo = createInMemoryRepository();

    const preview = repo.ngos.getForMatch("mat-thinkpads", corporateAcme);
    expect(preview).toEqual({
      id: "ngo-kleiderkammer",
      country: "Germany",
      focus: "Clothing aid",
      verificationState: "verified",
      trustScore: 91
    });
    expect(preview && "contactEmail" in preview).toBe(false);

    repo.matches.transition("mat-thinkpads", "ngo_confirmed", ngoKleiderkammer);
    repo.matches.transition("mat-thinkpads", "both_confirmed", corporateAcme);

    const full = repo.ngos.getForMatch("mat-thinkpads", corporateAcme);
    expect(full && "contactEmail" in full).toBe(true);
    expect(full && "address" in full).toBe(true);
  });

  it("keeps admin-only messages hidden from customer parties", () => {
    const repo = createInMemoryRepository();

    expect(repo.messages.listForMatch("mat-thinkpads", corporateAcme)).toHaveLength(1);
    expect(repo.messages.listForMatch("mat-thinkpads", admin)).toHaveLength(2);
  });

  it("creates match messages only inside the actor visibility boundary", () => {
    const repo = createInMemoryRepository();
    const outsideNgo = {
      role: "ngo",
      userId: "usr-ngo-kleiderkammer",
      ngoId: "ngo-tafel"
    } as const;

    expect(repo.messages.create("mat-thinkpads", "   ", corporateAcme)).toEqual({
      ok: false,
      reason: "empty_body"
    });
    expect(repo.messages.create("mat-thinkpads", "Can we schedule pickup?", outsideNgo)).toEqual({
      ok: false,
      reason: "actor_not_allowed"
    });

    const result = repo.messages.create("mat-thinkpads", "Can we schedule pickup?", corporateAcme);
    expect(result.ok).toBe(true);
    expect(result.ok && result.message).toMatchObject({
      matchId: "mat-thinkpads",
      authorId: "usr-corporate-acme",
      body: "Can we schedule pickup?",
      visibility: "customer_visible"
    });
    expect(repo.messages.listForMatch("mat-thinkpads", ngoKleiderkammer)).toHaveLength(2);
    expect(repo.auditEvents.list().some((event) => event.action === "message.created")).toBe(true);
  });

  it("runs the agent loop as proposal, human approval, then execution", () => {
    const repo = createInMemoryRepository();

    const runs = repo.agentRuns.list(corporateAcme);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("needs_approval");

    const actions = repo.proposedActions.listForRun(runs[0].id, corporateAcme);
    expect(actions).toHaveLength(2);
    expect(actions.every((action) => action.requiresHumanApproval)).toBe(true);

    expect(repo.proposedActions.execute(actions[0].id, corporateAcme)).toEqual({
      ok: false,
      reason: "approval_required"
    });

    const approval = repo.proposedActions.approve(actions[0].id, corporateAcme);
    expect(approval.ok).toBe(true);
    expect(repo.proposedActions.execute(actions[0].id, corporateAcme).ok).toBe(true);
    expect(repo.messages.listForMatch("mat-thinkpads", corporateAcme)).toHaveLength(2);
    expect(repo.messages.listForMatch("mat-thinkpads", corporateAcme).at(-1)?.body).toBe(
      "Could you confirm whether the training room can receive 45 wiped laptops in late June?"
    );

    const runAfterExecution = repo.agentRuns.get(runs[0].id, corporateAcme);
    expect(runAfterExecution?.status).toBe("needs_approval");
    expect(repo.auditEvents.list().some((event) => event.action === "agent.action.executed")).toBe(true);
  });

  it("applies listing review flags only after approval execution", () => {
    const repo = createInMemoryRepository();
    const run = repo.agentRuns.list(corporateAcme)[0];
    const action = repo.proposedActions.listForRun(run.id, corporateAcme).find((item) => item.targetType === "listing");

    expect(action).toBeDefined();
    expect(repo.listings.get("lst-thinkpads")?.reviewFlags).not.toContain("data_wipe_review_required");
    expect(repo.proposedActions.execute(action!.id, corporateAcme)).toEqual({
      ok: false,
      reason: "approval_required"
    });

    expect(repo.proposedActions.approve(action!.id, corporateAcme).ok).toBe(true);
    expect(repo.proposedActions.execute(action!.id, corporateAcme).ok).toBe(true);
    expect(repo.listings.get("lst-thinkpads")?.reviewFlags).toContain("data_wipe_review_required");
  });

  it("keeps agent approvals inside the actor visibility boundary", () => {
    const repo = createInMemoryRepository();
    const run = repo.agentRuns.list(corporateAcme)[0];
    const action = repo.proposedActions.listForRun(run.id, corporateAcme)[0];

    expect(repo.agentRuns.list(ngoKleiderkammer)).toEqual([]);
    expect(repo.proposedActions.approve(action.id, ngoKleiderkammer)).toEqual({
      ok: false,
      reason: "actor_not_allowed"
    });
  });

  it("creates live agent runs as pending proposals only", () => {
    const repo = createInMemoryRepository();

    const result = repo.agentRuns.create(corporateAcme, {
      taskType: "match_review",
      targetType: "match",
      targetId: "mat-thinkpads",
      prompt: "Draft a concise next-step message based on the current ThinkPad match.",
      attachments: [{ name: "serials.csv", mime: "text/csv", sizeBytes: 4200 }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.run.status).toBe("needs_approval");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      status: "pending",
      requiresHumanApproval: true,
      targetType: "message",
      targetId: "mat-thinkpads"
    });
    expect(repo.messages.listForMatch("mat-thinkpads", corporateAcme)).toHaveLength(1);
    expect(repo.proposedActions.execute(result.actions[0].id, corporateAcme)).toEqual({
      ok: false,
      reason: "approval_required"
    });
    expect(repo.auditEvents.list().some((event) => event.action === "agent.run.created")).toBe(true);
  });

  it("creates social-ad documents as drafts and publishes only after approval execution", () => {
    // Social media cards are a Tree feature, so this company is on Tree.
    const data = createSeedData();
    const acme = data.companies.find((company) => company.id === "co-acme");
    if (acme) acme.plan = "tree";
    const repo = createInMemoryRepository(data);

    const result = repo.agentRuns.create(corporateAcme, {
      taskType: "social_ad",
      targetType: "match",
      targetId: "mat-thinkpads",
      prompt: "LinkedIn draft for the ThinkPad reuse match with verified impact wording."
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.document).toMatchObject({
      kind: "social_ad",
      status: "draft",
      matchId: "mat-thinkpads",
      companyId: "co-acme",
      publishedAt: null
    });
    expect(result.run.producedDocumentId).toBe(result.document?.id);
    expect(result.actions[0]).toMatchObject({
      status: "pending",
      targetType: "document",
      targetId: result.document?.id,
      requiresHumanApproval: true
    });
    expect(repo.documents.get(result.document!.id, corporateAcme)?.status).toBe("draft");

    expect(repo.proposedActions.execute(result.actions[0].id, corporateAcme)).toEqual({
      ok: false,
      reason: "approval_required"
    });
    expect(repo.documents.get(result.document!.id, corporateAcme)?.status).toBe("draft");

    expect(repo.proposedActions.approve(result.actions[0].id, corporateAcme).ok).toBe(true);
    expect(repo.proposedActions.execute(result.actions[0].id, corporateAcme).ok).toBe(true);
    expect(repo.documents.get(result.document!.id, corporateAcme)).toMatchObject({
      status: "published",
      publishedAt: "2026-06-24T00:00:00.000Z"
    });
  });

  it("rejects agent runs against targets outside the actor boundary", () => {
    const repo = createInMemoryRepository();
    const outsideNgo = {
      role: "ngo",
      userId: "usr-ngo-kleiderkammer",
      ngoId: "ngo-tafel"
    } as const;

    expect(
      repo.agentRuns.create(outsideNgo, {
        taskType: "match_review",
        targetType: "match",
        targetId: "mat-thinkpads",
        prompt: "Draft a message for a match I cannot access."
      })
    ).toEqual({
      ok: false,
      reason: "actor_not_allowed"
    });
  });

  it("rejects match agent runs without a concrete match target", () => {
    const repo = createInMemoryRepository();

    expect(
      repo.agentRuns.create(corporateAcme, {
        taskType: "message_draft",
        prompt: "Draft a message without a match target."
      })
    ).toEqual({
      ok: false,
      reason: "invalid_target"
    });
  });
});

describe("supabase repository seam", () => {
  it("loads PostgREST rows into the canonical repository model", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const table = url.pathname.split("/").at(-1) ?? "";
      const headers = init?.headers as Record<string, string>;

      requests.push(`${table}:${headers.apikey}:${headers.authorization}`);

      return new Response(JSON.stringify(supabaseRows[table] ?? []), { status: 200 });
    };

    const data = await loadRepositoryDataFromSupabaseRest({
      url: "https://example.supabase.co",
      key: "service-key",
      fetchImpl
    });

    expect(data.companies[0]).toMatchObject({
      id: "co-acme",
      ownerName: "Lea Weber",
      plan: "seed"
    });
    expect(data.invitations[0]).toMatchObject({
      id: "inv-acme-ops",
      email: "ops@acme.example",
      role: "corporate",
      companyId: "co-acme",
      status: "pending"
    });
    expect(data.invitationDeliveryAttempts[0]).toMatchObject({
      id: "del-acme-ops-1",
      invitationId: "inv-acme-ops",
      operation: "create",
      provider: "resend",
      status: "sent",
      messageId: "msg-123"
    });
    expect(data.listings[0].eligibility).toEqual({
      usable: true,
      policyFit: true,
      ownership: true
    });
    expect(data.messages[1].visibility).toBe("admin_only");
    expect(data.documents[0]).toMatchObject({
      id: "doc-social-draft",
      kind: "social_ad",
      status: "draft",
      companyId: "co-acme",
      matchId: "mat-thinkpads"
    });
    expect(data.agentRuns[0]).toMatchObject({
      id: "run-match-loop-acme",
      status: "needs_approval"
    });
    expect(data.proposedActions[0]).toMatchObject({
      id: "act-draft-ngo-message",
      riskLevel: "medium",
      requiresHumanApproval: true
    });
    expect(requests).toContain("companies:service-key:Bearer service-key");
  });

  it("uses the caller bearer token when loading Supabase through authenticated RLS", async () => {
    const requests: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const table = new URL(String(input)).pathname.split("/").at(-1) ?? "";
      const headers = init?.headers as Record<string, string>;

      requests.push(`${table}:${headers.apikey}:${headers.authorization}`);

      return new Response(JSON.stringify(supabaseRows[table] ?? []), { status: 200 });
    };

    await loadRepositoryDataFromSupabaseRest({
      url: "https://example.supabase.co",
      key: "anon-key",
      authorization: "Bearer user-jwt",
      fetchImpl
    });

    expect(requests).toContain("companies:anon-key:Bearer user-jwt");
  });

  it("creates invitations through the Supabase RPC boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          id: "inv-new-member",
          email: "ops@acme.example",
          role: "corporate",
          company_id: "co-acme",
          ngo_id: null,
          org_name: "Acme GmbH",
          status: "pending",
          expires_at: "2026-07-01",
          acceptance_token_hash: "b".repeat(64),
          accepted_at: null,
          accepted_by: null,
          created_at: "2026-06-24T00:00:00.000Z"
        }),
        { status: 200 }
      );
    };

    const invitation = await createInvitationWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      },
      {
        email: "ops@acme.example",
        role: "corporate",
        companyId: "co-acme",
        orgName: "Acme GmbH",
        expiresAt: "2026-07-01"
      }
    );

    expect(invitation).toMatchObject({
      id: "inv-new-member",
      companyId: "co-acme",
      email: "ops@acme.example",
      role: "corporate",
      status: "pending"
    });
    expect(requests).toEqual([
      {
        body: {
          p_email: "ops@acme.example",
          p_role: "corporate",
          p_company_id: "co-acme",
          p_ngo_id: null,
          p_org_name: "Acme GmbH",
          p_expires_at: "2026-07-01",
          p_acceptance_token_hash: null
        },
        headers: {
          apikey: "anon-key",
          authorization: "Bearer user-jwt",
          "content-type": "application/json"
        },
        path: "/rest/v1/rpc/create_invitation"
      }
    ]);
  });

  it("accepts invitations through the Supabase RPC boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          id: "usr-new-member",
          email: "ops@acme.example",
          full_name: "Lena Ops",
          role: "corporate",
          company_id: "co-acme",
          ngo_id: null,
          created_at: "2026-06-24T00:00:00.000Z"
        }),
        { status: 200 }
      );
    };

    const user = await acceptInvitationWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer invitee-jwt",
        fetchImpl
      },
      {
        acceptanceToken: "invite-token",
        fullName: "Lena Ops"
      }
    );

    expect(user).toMatchObject({
      id: "usr-new-member",
      companyId: "co-acme",
      email: "ops@acme.example",
      role: "corporate"
    });
    expect(requests).toEqual([
      {
        body: {
          p_acceptance_token: "invite-token",
          p_full_name: "Lena Ops"
        },
        headers: {
          apikey: "anon-key",
          authorization: "Bearer invitee-jwt",
          "content-type": "application/json"
        },
        path: "/rest/v1/rpc/accept_invitation"
      }
    ]);
  });

  it("revokes invitations through the Supabase RPC boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          id: "inv-acme-ops",
          email: "ops@acme.example",
          role: "corporate",
          company_id: "co-acme",
          ngo_id: null,
          org_name: "Acme GmbH",
          status: "revoked",
          expires_at: "2026-07-01",
          acceptance_token_hash: null,
          accepted_at: null,
          accepted_by: null,
          created_at: "2026-06-24T00:00:00.000Z"
        }),
        { status: 200 }
      );
    };

    const result = await revokeInvitationWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      },
      "inv-acme-ops"
    );

    expect(result).toMatchObject({
      ok: true,
      invitation: {
        id: "inv-acme-ops",
        status: "revoked"
      }
    });
    expect(requests).toEqual([
      {
        body: {
          p_invitation_id: "inv-acme-ops"
        },
        headers: {
          apikey: "anon-key",
          authorization: "Bearer user-jwt",
          "content-type": "application/json"
        },
        path: "/rest/v1/rpc/revoke_invitation"
      }
    ]);
  });

  it("resends invitations through the Supabase RPC boundary with a rotated token hash", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          id: "inv-acme-ops",
          email: "ops@acme.example",
          role: "corporate",
          company_id: "co-acme",
          ngo_id: null,
          org_name: "Acme GmbH",
          status: "pending",
          expires_at: "2026-07-01",
          acceptance_token_hash: "b".repeat(64),
          accepted_at: null,
          accepted_by: null,
          created_at: "2026-06-24T00:00:00.000Z"
        }),
        { status: 200 }
      );
    };

    const result = await resendInvitationWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      },
      {
        acceptanceTokenHash: "b".repeat(64),
        invitationId: "inv-acme-ops"
      }
    );

    expect(result).toMatchObject({
      ok: true,
      invitation: {
        id: "inv-acme-ops",
        status: "pending"
      }
    });
    expect(requests).toEqual([
      {
        body: {
          p_acceptance_token_hash: "b".repeat(64),
          p_invitation_id: "inv-acme-ops"
        },
        headers: {
          apikey: "anon-key",
          authorization: "Bearer user-jwt",
          "content-type": "application/json"
        },
        path: "/rest/v1/rpc/resend_invitation"
      }
    ]);
  });

  it("records invitation delivery attempts through the Supabase RPC boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          id: "del-acme-ops-2",
          invitation_id: "inv-acme-ops",
          operation: "resend",
          provider: "webhook",
          status: "failed",
          message_id: null,
          error: "email_delivery_failed_502",
          reason: null,
          actor_id: "usr-admin-ops",
          created_at: "2026-06-24T00:00:00.000Z"
        }),
        { status: 200 }
      );
    };

    const result = await recordInvitationDeliveryAttemptWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      },
      {
        error: "email_delivery_failed_502",
        invitationId: "inv-acme-ops",
        operation: "resend",
        provider: "webhook",
        status: "failed"
      }
    );

    expect(result).toMatchObject({
      ok: true,
      attempt: {
        error: "email_delivery_failed_502",
        invitationId: "inv-acme-ops",
        operation: "resend",
        provider: "webhook",
        status: "failed"
      }
    });
    expect(requests).toEqual([
      {
        body: {
          p_error: "email_delivery_failed_502",
          p_invitation_id: "inv-acme-ops",
          p_message_id: null,
          p_operation: "resend",
          p_provider: "webhook",
          p_reason: null,
          p_status: "failed"
        },
        headers: {
          apikey: "anon-key",
          authorization: "Bearer user-jwt",
          "content-type": "application/json"
        },
        path: "/rest/v1/rpc/record_invitation_delivery_attempt"
      }
    ]);
  });

  it("creates messages through the Supabase RPC boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          id: "msg-new",
          matchId: "mat-thinkpads",
          authorId: "usr-corporate-acme",
          body: "Can Florian confirm pickup timing?",
          visibility: "customer_visible",
          createdAt: "2026-06-24T00:00:00.000Z"
        }),
        { status: 200 }
      );
    };

    const result = await createMessageWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      },
      {
        matchId: "mat-thinkpads",
        body: "Can Florian confirm pickup timing?"
      }
    );

    expect(result).toEqual({
      ok: true,
      message: {
        id: "msg-new",
        matchId: "mat-thinkpads",
        authorId: "usr-corporate-acme",
        body: "Can Florian confirm pickup timing?",
        visibility: "customer_visible",
        createdAt: "2026-06-24T00:00:00.000Z"
      }
    });
    expect(requests).toEqual([
      {
        body: {
          p_match_id: "mat-thinkpads",
          p_body: "Can Florian confirm pickup timing?"
        },
        headers: {
          apikey: "anon-key",
          authorization: "Bearer user-jwt",
          "content-type": "application/json"
        },
        path: "/rest/v1/rpc/create_message"
      }
    ]);
  });

  it("creates agent runs through the Supabase RPC boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          run: {
            id: "run-new",
            role: "corporate",
            companyId: "co-acme",
            ngoId: null,
            taskType: "message_draft",
            title: "Review match next step",
            prompt: "Draft next step.",
            status: "needs_approval",
            summary: "Prepared a match-review draft. The message remains blocked until a human approves it.",
            findings: [],
            attachments: [],
            producedDocumentId: null,
            createdAt: "2026-06-24T00:00:00.000Z",
            completedAt: null
          },
          actions: [
            {
              id: "act-new",
              runId: "run-new",
              label: "Send reviewed match message",
              description: "Create a customer-visible match message only after human approval.",
              status: "pending",
              riskLevel: "medium",
              targetType: "message",
              targetId: "mat-thinkpads",
              proposedPayload: { body: "Draft for human review:\n\nDraft next step." },
              requiresHumanApproval: true,
              approvedBy: null,
              approvedAt: null,
              executedAt: null
            }
          ],
          document: null
        }),
        { status: 200 }
      );
    };

    const result = await createAgentRunWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      },
      {
        taskType: "message_draft",
        targetType: "match",
        targetId: "mat-thinkpads",
        prompt: "Draft next step."
      }
    );

    expect(result).toMatchObject({
      ok: true,
      run: { id: "run-new", status: "needs_approval" },
      actions: [{ id: "act-new", status: "pending" }],
      document: null
    });
    expect(requests[0]).toMatchObject({
      headers: {
        apikey: "anon-key",
        authorization: "Bearer user-jwt",
        "content-type": "application/json"
      },
      path: "/rest/v1/rpc/create_agent_run"
    });
    expect(requests[0].body).toMatchObject({
      p_task_type: "message_draft",
      p_prompt: "Draft next step.",
      p_target_type: "match",
      p_target_id: "mat-thinkpads",
      p_proposed_actions: [
        {
          label: "Send reviewed match message",
          riskLevel: "medium",
          targetType: "message",
          targetId: "mat-thinkpads"
        }
      ]
    });
  });

  it("performs agent actions through the Supabase RPC boundary", async () => {
    const requests: Array<{ body: unknown; headers: Record<string, string>; path: string }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        body: JSON.parse(String(init?.body)),
        headers: init?.headers as Record<string, string>,
        path: new URL(String(input)).pathname
      });

      return new Response(
        JSON.stringify({
          id: "act-new",
          runId: "run-new",
          label: "Send reviewed match message",
          description: "Create a customer-visible match message only after human approval.",
          status: "approved",
          riskLevel: "medium",
          targetType: "message",
          targetId: "mat-thinkpads",
          proposedPayload: { body: "Draft" },
          requiresHumanApproval: true,
          approvedBy: "usr-corporate-acme",
          approvedAt: "2026-06-24T00:00:00.000Z",
          executedAt: null
        }),
        { status: 200 }
      );
    };

    const result = await performAgentActionWithSupabaseRpc(
      {
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      },
      "approve",
      "act-new"
    );

    expect(result).toMatchObject({
      ok: true,
      action: {
        id: "act-new",
        approvedBy: "usr-corporate-acme",
        status: "approved"
      }
    });
    expect(requests).toEqual([
      {
        body: {
          p_action_id: "act-new",
          p_operation: "approve"
        },
        headers: {
          apikey: "anon-key",
          authorization: "Bearer user-jwt",
          "content-type": "application/json"
        },
        path: "/rest/v1/rpc/perform_agent_action"
      }
    ]);
  });

  it("keeps auth visibility rules after loading from Supabase", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const table = new URL(String(input)).pathname.split("/").at(-1) ?? "";

      return new Response(JSON.stringify(supabaseRows[table] ?? []), { status: 200 });
    };

    const { repository } = await createSupabaseRestRepository({
      url: "https://example.supabase.co",
      key: "service-key",
      fetchImpl
    });

    expect(repository.assertReferentialIntegrity()).toEqual([]);
    expect(repository.messages.listForMatch("mat-thinkpads", corporateAcme)).toHaveLength(1);
    expect(repository.messages.listForMatch("mat-thinkpads", admin)).toHaveLength(2);

    const preview = repository.ngos.getForMatch("mat-thinkpads", corporateAcme);
    expect(preview && "contactEmail" in preview).toBe(false);
  });

  it("surfaces table-specific Supabase load failures", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const table = new URL(String(input)).pathname.split("/").at(-1) ?? "";

      return table === "matches"
        ? new Response("rls denied", { status: 403 })
        : new Response(JSON.stringify(supabaseRows[table] ?? []), { status: 200 });
    };

    await expect(
      loadRepositoryDataFromSupabaseRest({
        url: "https://example.supabase.co",
        key: "service-key",
        fetchImpl
      })
    ).rejects.toThrow("Failed to load matches from Supabase (403)");
  });

  it("returns an empty open-needs directory as an empty list, not an error", async () => {
    const fetchImpl: typeof fetch = async () => new Response(JSON.stringify([]), { status: 200 });

    await expect(
      fetchOpenNeedsDirectoryWithSupabase({
        url: "https://example.supabase.co",
        key: "anon-key",
        authorization: "Bearer user-jwt",
        fetchImpl
      })
    ).resolves.toEqual([]);
  });

  it("maps every row of a populated open-needs directory", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify([
          {
            need_id: "need-blankets",
            title: "Winter blankets",
            category: "Textiles",
            quantity: 200,
            quantity_open: true,
            urgency: "asap",
            country: "Germany",
            ngo_focus: "Homeless support",
            ngo_country: "Germany",
            quantity_remaining: 200,
            delivery_preference: "collect",
            max_quantity_per_match: 40,
            target_group: "Shelter guests"
          },
          {
            need_id: "need-laptops",
            title: "Refurbished laptops",
            category: "Electronics",
            quantity: 40,
            quantity_open: false,
            urgency: "flexible",
            country: "Austria",
            ngo_focus: "Education",
            ngo_country: "Austria",
            quantity_remaining: 40,
            delivery_preference: "either",
            max_quantity_per_match: null,
            target_group: "Evening students"
          }
        ]),
        { status: 200 }
      );

    const rows = await fetchOpenNeedsDirectoryWithSupabase({
      url: "https://example.supabase.co",
      key: "anon-key",
      authorization: "Bearer user-jwt",
      fetchImpl
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      needId: "need-blankets",
      title: "Winter blankets",
      category: "Textiles",
      quantity: 200,
      quantityOpen: true,
      urgency: "asap",
      country: "Germany",
      ngoFocus: "Homeless support",
      ngoCountry: "Germany",
      quantityRemaining: 200,
      deliveryPreference: "collect",
      maxQuantityPerMatch: 40,
      targetGroup: "Shelter guests"
    });
    expect(rows[1].needId).toBe("need-laptops");
  });
});

const supabaseRows: Record<string, unknown[]> = {
  companies: [
    {
      id: "co-acme",
      name: "Acme GmbH",
      plan: "seed",
      status: "active",
      city: "Munich",
      country: "Germany",
      owner_name: "Lea Weber",
      contact_email: "lea.weber@example.com",
      reporting_email: "sustainability@example.com",
      created_at: "2026-01-05T09:00:00.000Z"
    }
  ],
  ngos: [
    {
      id: "ngo-kleiderkammer",
      name: "Kleiderkammer e.V.",
      city: "Munich",
      country: "Germany",
      focus: "Clothing aid",
      verification_state: "verified",
      trust_score: 91,
      board_contact: "Anna Becker",
      contact_email: "anna@example.org",
      contact_phone: "+49 89 123456",
      address: "Beispielstrasse 12, 80331 Munich",
      verified_at: "2026-02-08",
      created_at: "2026-01-21T09:00:00.000Z"
    }
  ],
  users: [
    {
      id: "usr-corporate-acme",
      email: "corporate@sur.plus.demo",
      full_name: "Lena Hoffmann",
      role: "corporate",
      company_id: "co-acme",
      ngo_id: null,
      created_at: "2026-01-05T09:00:00.000Z"
    },
    {
      id: "usr-ngo-kleiderkammer",
      email: "ngo@sur.plus.demo",
      full_name: "Anna Becker",
      role: "ngo",
      company_id: null,
      ngo_id: "ngo-kleiderkammer",
      created_at: "2026-01-21T09:00:00.000Z"
    },
    {
      id: "usr-admin-ops",
      email: "admin@sur.plus.demo",
      full_name: "sur.plus Ops",
      role: "admin",
      company_id: null,
      ngo_id: null,
      created_at: "2026-01-01T09:00:00.000Z"
    }
  ],
  invitations: [
    {
      id: "inv-acme-ops",
      email: "ops@acme.example",
      role: "corporate",
      company_id: "co-acme",
      ngo_id: null,
      org_name: "Acme GmbH",
      status: "pending",
      expires_at: "2026-07-01",
      acceptance_token_hash: "a".repeat(64),
      accepted_at: null,
      accepted_by: null,
      created_at: "2026-06-02T08:00:00.000Z"
    }
  ],
  invitation_delivery_attempts: [
    {
      id: "del-acme-ops-1",
      invitation_id: "inv-acme-ops",
      operation: "create",
      provider: "resend",
      status: "sent",
      message_id: "msg-123",
      error: null,
      reason: null,
      actor_id: "usr-admin-ops",
      created_at: "2026-06-02T08:01:00.000Z"
    }
  ],
  listings: [
    {
      id: "lst-thinkpads",
      company_id: "co-acme",
      title: "Lenovo ThinkPad L14 Gen 3",
      category: "IT & Electronics",
      subcategory: "Laptops",
      quantity: 200,
      unit: "units",
      unit_value: 71,
      city: "Munich",
      country: "Germany",
      condition: "Good",
      state: "match_pending",
      available_until: "2026-06-18",
      pickup_window: "Weekdays, 09:00-16:00",
      packaging: "Palletized",
      weight_kg: 820,
      category_details: "Chargers included.",
      photos: ["thinkpad-front.jpg"],
      attachments: ["thinkpad-serials.csv"],
      review_flags: ["admin_review_category"],
      eligibility: { usable: true, policyFit: true, ownership: true },
      created_at: "2026-05-12T09:00:00.000Z"
    }
  ],
  needs: [
    {
      id: "need-laptops",
      ngo_id: "ngo-kleiderkammer",
      title: "Laptops for training room",
      category: "IT & Electronics",
      quantity: 45,
      city: "Munich",
      country: "Germany",
      target_date: "2026-07-01",
      beneficiaries: 180,
      state: "open",
      story: "Digital literacy classes need wiped laptops.",
      created_at: "2026-05-01T09:00:00.000Z"
    }
  ],
  matches: [
    {
      id: "mat-thinkpads",
      listing_id: "lst-thinkpads",
      need_id: "need-laptops",
      state: "proposed",
      score: 94,
      co2_tons: 8.6,
      pickup_date: "2026-06-21",
      delivery_date: "2026-06-25",
      carrier: null,
      tracking_ref: null,
      created_at: "2026-06-01T09:00:00.000Z"
    }
  ],
  messages: [
    {
      id: "msg-thinkpads-1",
      match_id: "mat-thinkpads",
      author_id: "usr-admin-ops",
      body: "Initial fit looks strong; waiting for NGO confirmation.",
      visibility: "customer_visible",
      created_at: "2026-06-01T10:00:00.000Z"
    },
    {
      id: "msg-thinkpads-internal",
      match_id: "mat-thinkpads",
      author_id: "usr-admin-ops",
      body: "Check serial CSV before releasing final contact details.",
      visibility: "admin_only",
      created_at: "2026-06-01T10:05:00.000Z"
    }
  ],
  documents: [
    {
      id: "doc-social-draft",
      kind: "social_ad",
      title: "ThinkPad social draft",
      status: "draft",
      company_id: "co-acme",
      ngo_id: null,
      match_id: "mat-thinkpads",
      storage_path: null,
      mime: "text/markdown",
      size_bytes: 240,
      created_by: "usr-corporate-acme",
      created_at: "2026-06-02T11:00:00.000Z",
      published_at: null
    }
  ],
  audit_events: [
    {
      id: "aud-seed-import",
      actor: "system",
      action: "seed.imported",
      target: "repository",
      visibility: "admin_only",
      created_at: "2026-06-01T09:00:00.000Z"
    }
  ],
  agent_runs: [
    {
      id: "run-match-loop-acme",
      role: "corporate",
      company_id: "co-acme",
      ngo_id: null,
      task_type: "match_review",
      title: "Review ThinkPad match before outreach",
      prompt: "Assess the proposed ThinkPad match.",
      status: "needs_approval",
      summary: "Strong fit, but outreach needs human approval.",
      findings: [
        {
          label: "Fit",
          detail: "Category and location fit.",
          severity: "info"
        }
      ],
      attachments: [],
      produced_document_id: null,
      created_at: "2026-06-02T09:00:00.000Z",
      completed_at: null
    }
  ],
  agent_proposed_actions: [
    {
      id: "act-draft-ngo-message",
      run_id: "run-match-loop-acme",
      label: "Draft NGO confirmation message",
      description: "Prepare a message but do not send it.",
      status: "pending",
      risk_level: "medium",
      target_type: "message",
      target_id: "mat-thinkpads",
      proposed_payload: {
        body: "Could you confirm whether the training room can receive 45 wiped laptops?"
      },
      requires_human_approval: true,
      approved_by: null,
      approved_at: null,
      executed_at: null
    }
  ]
};

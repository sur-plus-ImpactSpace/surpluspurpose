import { describe, expect, it } from "vitest";
import {
  buildOpsRiskQueue,
  type OpsRiskQueueInput
} from "./ops-risk-queue";
import {
  type AgentProposedAction,
  type AgentRun,
  type Company,
  type CompanyCheck,
  type Listing,
  type Ngo
} from "./model";

function run(overrides: Partial<AgentRun> & Pick<AgentRun, "id">): AgentRun {
  return {
    role: "admin",
    companyId: null,
    ngoId: null,
    taskType: "ngo_verification",
    title: "Run",
    prompt: "",
    status: "completed",
    summary: "",
    findings: [],
    attachments: [],
    producedDocumentId: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    ...overrides
  };
}

function action(
  overrides: Partial<AgentProposedAction> & Pick<AgentProposedAction, "id" | "runId">
): AgentProposedAction {
  return {
    label: "Proposed action",
    description: "Needs review",
    status: "pending",
    riskLevel: "medium",
    targetType: null,
    targetId: null,
    proposedPayload: {},
    requiresHumanApproval: true,
    approvedBy: null,
    approvedAt: null,
    executedAt: null,
    ...overrides
  };
}

function ngo(overrides: Partial<Ngo> & Pick<Ngo, "id">): Ngo {
  return {
    name: "NGO",
    city: "Berlin",
    country: "Germany",
    focus: "Education",
    verificationState: "verified",
    trustScore: 80,
    boardContact: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    verifiedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function listing(overrides: Partial<Listing> & Pick<Listing, "id">): Listing {
  return {
    companyId: "co-1",
    title: "Listing",
    category: "IT & Electronics",
    subcategory: null,
    quantity: 1,
    unit: "units",
    unitValue: 100,
    city: "Munich",
    country: "Germany",
    condition: "Good",
    state: "open",
    availableUntil: null,
    pickupWindow: "",
    packaging: "",
    weightKg: 0,
    categoryDetails: "",
    photos: [],
    attachments: [],
    reviewFlags: [],
    eligibility: { usable: true, policyFit: true, ownership: true },
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function input(overrides: Partial<OpsRiskQueueInput> = {}): OpsRiskQueueInput {
  return { proposedActions: [], agentRuns: [], ngos: [], listings: [], ...overrides };
}

describe("buildOpsRiskQueue", () => {
  it("aggregates and prioritizes ops-relevant items by risk then recency", () => {
    const data = input({
      agentRuns: [
        run({ id: "run-a", status: "needs_approval", createdAt: "2026-06-10T00:00:00.000Z" }),
        run({ id: "run-b", status: "needs_approval", createdAt: "2026-06-03T00:00:00.000Z" }),
        run({ id: "run-c", status: "needs_approval", title: "Orphan run", summary: "no actions", createdAt: "2026-06-02T00:00:00.000Z" }),
        run({ id: "run-d", status: "approved", createdAt: "2026-06-09T00:00:00.000Z" })
      ],
      proposedActions: [
        action({ id: "act-high", runId: "run-a", riskLevel: "high", status: "pending" }),
        action({ id: "act-low", runId: "run-b", riskLevel: "low", status: "pending" }),
        action({ id: "act-approved", runId: "run-d", riskLevel: "high", status: "approved" })
      ],
      ngos: [
        ngo({ id: "ngo-review", name: "Review NGO", verificationState: "review" }),
        ngo({ id: "ngo-info", name: "Info NGO", verificationState: "pending_info" }),
        ngo({ id: "ngo-ok", verificationState: "verified" })
      ],
      listings: [
        listing({ id: "lst-high", reviewFlags: ["high_value"], createdAt: "2026-06-05T00:00:00.000Z" }),
        listing({ id: "lst-med", reviewFlags: ["admin_review_category"] }),
        listing({ id: "lst-none", reviewFlags: [] })
      ]
    });

    const queue = buildOpsRiskQueue(data);

    // total = high action + low action + orphan run-c + 2 ngos + 2 listings (verified ngo & unflagged listing excluded)
    expect(queue.counts.total).toBe(7);
    expect(queue.counts.high).toBe(2); // act-high + lst-high
    expect(queue.counts.medium).toBe(3); // run-c + ngo-review + lst-med
    expect(queue.counts.low).toBe(2); // act-low + ngo-info
    expect(queue.counts.byKind).toEqual({
      agent_action_approval: 2,
      agent_run_review: 1,
      company_verification: 0,
      scheduler_job_failure: 0,
      ngo_verification: 2,
      ngo_proof_expiring: 0,
      listing_review: 2
    });

    // high band first; within it newest createdAt wins (run-a 06-10 > lst-high 06-05)
    expect(queue.items[0].riskLevel).toBe("high");
    expect(queue.items[0].id).toBe("agent_action_approval:act-high");
    expect(queue.items[1].id).toBe("listing_review:lst-high");
    // low band last
    expect(queue.items[queue.items.length - 1].riskLevel).toBe("low");

    // approved action and its run are not surfaced
    expect(queue.items.find((item) => item.targetId === "run-d")).toBeUndefined();
    expect(queue.items.find((item) => item.id.includes("act-approved"))).toBeUndefined();
  });

  it("does not double-list a needs_approval run that already has pending actions", () => {
    const data = input({
      agentRuns: [run({ id: "run-x", status: "needs_approval" })],
      proposedActions: [action({ id: "act-x", runId: "run-x", status: "pending" })]
    });

    const queue = buildOpsRiskQueue(data);

    expect(queue.counts.byKind.agent_action_approval).toBe(1);
    expect(queue.counts.byKind.agent_run_review).toBe(0);
  });

  it("returns an empty queue when nothing needs attention", () => {
    const queue = buildOpsRiskQueue(input());
    expect(queue.items).toEqual([]);
    expect(queue.counts.total).toBe(0);
  });
});


describe("company verifications in the risk queue", () => {
  const company = (id: string, verificationState: Company["verificationState"]): Company => ({
    id,
    name: `Company ${id}`,
    plan: "registered",
    status: "onboarding",
    verificationState,
    city: "",
    country: "",
    ownerName: "",
    contactEmail: "",
    reportingEmail: "",
    createdAt: "2026-06-01T00:00:00.000Z"
  });
  const check = (companyId: string, overrides: Partial<CompanyCheck> = {}): CompanyCheck => ({
    id: `chk-${companyId}`,
    companyId,
    vatOk: true,
    vatName: null,
    domainOk: true,
    websiteOk: true,
    outcome: "manual_review",
    createdAt: "2026-06-02T00:00:00.000Z",
    ...overrides
  });
  const base = { proposedActions: [], agentRuns: [], ngos: [], listings: [] };

  it("lists companies waiting on Ops and skips settled ones", () => {
    const queue = buildOpsRiskQueue({
      ...base,
      companies: [company("a", "review"), company("b", "verified"), company("c", "rejected"), company("d", "onboarding"), company("e", "pending_info")]
    });

    expect(queue.items.map((item) => item.id).sort()).toEqual(["company_verification:a", "company_verification:e"]);
    expect(queue.counts.byKind.company_verification).toBe(2);
  });

  it("shows which automatic checks failed", () => {
    const queue = buildOpsRiskQueue({
      ...base,
      companies: [company("a", "review")],
      companyChecks: [check("a", { vatOk: false })]
    });

    expect(queue.items[0]?.detail).toBe("Automatic check: VAT ID failed · email domain ok · website ok");
    expect(queue.items[0]).toMatchObject({ kind: "company_verification", targetType: "company", targetId: "a" });
  });

  it("uses the newest check", () => {
    const queue = buildOpsRiskQueue({
      ...base,
      companies: [company("a", "review")],
      companyChecks: [
        check("a", { id: "old", vatOk: false, createdAt: "2026-06-01T00:00:00.000Z" }),
        check("a", { id: "new", websiteOk: false, createdAt: "2026-06-03T00:00:00.000Z" })
      ]
    });

    expect(queue.items[0]?.detail).toContain("VAT ID ok");
    expect(queue.items[0]?.detail).toContain("website failed");
  });
});

describe("scheduler job failures in the risk queue", () => {
  it("lists unacknowledged failed runs as high risk and skips ok or acked runs", () => {
    const queue = buildOpsRiskQueue({
      proposedActions: [],
      agentRuns: [],
      ngos: [],
      listings: [],
      schedulerJobRuns: [
        {
          id: "job-fail",
          jobName: "expire_stale_proposals",
          startedAt: "2026-06-04T03:15:00.000Z",
          finishedAt: "2026-06-04T03:15:01.000Z",
          recordsProcessed: null,
          status: "failed",
          errorText: "boom",
          acknowledgedAt: null,
          acknowledgedBy: null,
          createdAt: "2026-06-04T03:15:00.000Z"
        },
        {
          id: "job-ok",
          jobName: "warn_expiring_proposals",
          startedAt: "2026-06-04T03:30:00.000Z",
          finishedAt: "2026-06-04T03:30:01.000Z",
          recordsProcessed: 2,
          status: "ok",
          errorText: null,
          acknowledgedAt: null,
          acknowledgedBy: null,
          createdAt: "2026-06-04T03:30:00.000Z"
        },
        {
          id: "job-acked",
          jobName: "expire_stale_proposals",
          startedAt: "2026-06-03T03:15:00.000Z",
          finishedAt: "2026-06-03T03:15:01.000Z",
          recordsProcessed: null,
          status: "failed",
          errorText: "old boom",
          acknowledgedAt: "2026-06-03T10:00:00.000Z",
          acknowledgedBy: "usr-admin",
          createdAt: "2026-06-03T03:15:00.000Z"
        }
      ]
    });

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toMatchObject({
      id: "scheduler_job_failure:job-fail",
      kind: "scheduler_job_failure",
      riskLevel: "high",
      detail: "boom"
    });
    expect(queue.counts.byKind.scheduler_job_failure).toBe(1);
  });
});

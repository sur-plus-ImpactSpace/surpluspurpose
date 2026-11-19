import {
  type AgentProposedAction,
  type AgentRun,
  type Company,
  type CompanyCheck,
  type CompanyVerificationState,
  isNgoProofExpiringSoon,
  type Listing,
  type LoopRiskLevel,
  type Ngo,
  type NgoVerificationState,
  type SchedulerJobRun
} from "./model";

/**
 * E25 — Ops Risk / Audit Queue (read-only domain projection).
 *
 * Aggregates everything that needs human ops attention into one prioritized
 * list, so the admin/ops cockpit has a single source for "what must I review".
 * Pure and deterministic: takes data, returns a sorted queue + counts.
 *
 * Sources, by design (keeps the agent review boundary and verification flow visible):
 *  - agent proposed actions still `pending` (require human approval)
 *  - agent runs `needs_approval` that have no pending actions (orphan catch)
 *  - NGOs in a verification state that waits on ops
 *  - listings carrying review flags
 *  - unacknowledged failed scheduler job runs (REQ-OPS-13)
 */

export const OPS_RISK_ITEM_KINDS = [
  "agent_action_approval",
  "agent_run_review",
  "ngo_verification",
  "ngo_proof_expiring",
  "company_verification",
  "listing_review",
  "scheduler_job_failure"
] as const;
export type OpsRiskItemKind = (typeof OPS_RISK_ITEM_KINDS)[number];

export type OpsRiskItem = {
  /** Stable, de-dupable id: `${kind}:${sourceId}`. */
  id: string;
  kind: OpsRiskItemKind;
  riskLevel: LoopRiskLevel;
  title: string;
  detail: string;
  targetType: string | null;
  targetId: string | null;
  /** ISO timestamp used for the recency tiebreak (newest first within a risk band). */
  createdAt: string;
};

export type OpsRiskQueueCounts = {
  total: number;
  high: number;
  medium: number;
  low: number;
  byKind: Record<OpsRiskItemKind, number>;
};

export type OpsRiskQueue = {
  items: OpsRiskItem[];
  counts: OpsRiskQueueCounts;
};

export type OpsRiskQueueInput = {
  proposedActions: AgentProposedAction[];
  agentRuns: AgentRun[];
  ngos: Ngo[];
  listings: Listing[];
  /** Company verifications waiting on Ops, with their automatic check results (ADR 0027 C3). */
  companies?: Company[];
  companyChecks?: CompanyCheck[];
  /** Failed timed jobs that Ops has not acknowledged yet (REQ-OPS-13). */
  schedulerJobRuns?: SchedulerJobRun[];
};

const RISK_ORDER: Record<LoopRiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** NGO verification states that still need an ops decision, mapped to a risk band. */
const NGO_REVIEW_RISK: Partial<Record<NgoVerificationState, LoopRiskLevel>> = {
  verification_pending: "medium",
  review: "medium",
  pending_info: "low"
};

/** Company verification states that still need an Ops decision. A failed automatic check lands in `review`. */
const COMPANY_REVIEW_RISK: Partial<Record<CompanyVerificationState, LoopRiskLevel>> = {
  review: "medium",
  verification_pending: "medium",
  pending_info: "low"
};

const mark = (ok: boolean) => (ok ? "ok" : "failed");

function listingRisk(reviewFlags: readonly string[]): LoopRiskLevel {
  return reviewFlags.some((flag) => flag.toLowerCase().includes("high")) ? "high" : "medium";
}

export function buildOpsRiskQueue(data: OpsRiskQueueInput): OpsRiskQueue {
  const runById = new Map(data.agentRuns.map((run) => [run.id, run] as const));
  const runHasPendingAction = new Set(
    data.proposedActions
      .filter((action) => action.status === "pending")
      .map((action) => action.runId)
  );

  const items: OpsRiskItem[] = [];

  for (const action of data.proposedActions) {
    if (action.status !== "pending") continue;
    items.push({
      id: `agent_action_approval:${action.id}`,
      kind: "agent_action_approval",
      riskLevel: action.riskLevel,
      title: action.label,
      detail: action.description,
      targetType: action.targetType,
      targetId: action.targetId,
      createdAt: runById.get(action.runId)?.createdAt ?? ""
    });
  }

  for (const run of data.agentRuns) {
    if (run.status !== "needs_approval") continue;
    if (runHasPendingAction.has(run.id)) continue; // already represented by its pending actions
    items.push({
      id: `agent_run_review:${run.id}`,
      kind: "agent_run_review",
      riskLevel: "medium",
      title: run.title,
      detail: run.summary,
      targetType: "agent_run",
      targetId: run.id,
      createdAt: run.createdAt
    });
  }

  for (const ngo of data.ngos) {
    const riskLevel = NGO_REVIEW_RISK[ngo.verificationState];
    if (riskLevel) {
      items.push({
        id: `ngo_verification:${ngo.id}`,
        kind: "ngo_verification",
        riskLevel,
        title: `NGO verification: ${ngo.name}`,
        detail: `Verification state: ${ngo.verificationState}`,
        targetType: "ngo",
        targetId: ngo.id,
        createdAt: ngo.createdAt
      });
    }
    if (isNgoProofExpiringSoon(ngo)) {
      items.push({
        id: `ngo_proof_expiring:${ngo.id}`,
        kind: "ngo_proof_expiring",
        riskLevel: "high",
        title: `NGO proof expiring: ${ngo.name}`,
        detail: `Proof valid until ${ngo.proofValidUntil ?? "unknown"} — renew before new matches are blocked.`,
        targetType: "ngo",
        targetId: ngo.id,
        createdAt: ngo.proofExpiryRemindedAt ?? ngo.verifiedAt ?? ngo.createdAt
      });
    }
  }

  for (const company of data.companies ?? []) {
    const riskLevel = COMPANY_REVIEW_RISK[company.verificationState ?? "onboarding"];
    if (!riskLevel) continue;
    const check = (data.companyChecks ?? [])
      .filter((item) => item.companyId === company.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    items.push({
      id: `company_verification:${company.id}`,
      kind: "company_verification",
      riskLevel,
      title: `Company verification: ${company.name}`,
      detail: check
        ? `Automatic check: VAT ID ${mark(check.vatOk)} · email domain ${mark(check.domainOk)} · website ${mark(check.websiteOk)}`
        : `Verification state: ${company.verificationState ?? "onboarding"}`,
      targetType: "company",
      targetId: company.id,
      createdAt: check?.createdAt ?? company.createdAt
    });
  }

  for (const listing of data.listings) {
    if (listing.reviewFlags.length === 0) continue;
    items.push({
      id: `listing_review:${listing.id}`,
      kind: "listing_review",
      riskLevel: listingRisk(listing.reviewFlags),
      title: `Listing review: ${listing.title}`,
      detail: `Review flags: ${listing.reviewFlags.join(", ")}`,
      targetType: "listing",
      targetId: listing.id,
      createdAt: listing.createdAt
    });
  }

  for (const run of data.schedulerJobRuns ?? []) {
    if (run.status !== "failed" || run.acknowledgedAt) continue;
    items.push({
      id: `scheduler_job_failure:${run.id}`,
      kind: "scheduler_job_failure",
      riskLevel: "high",
      title: `Scheduler job failed: ${run.jobName}`,
      detail: run.errorText ?? "Timed job failed without an error message.",
      targetType: "scheduler_job_run",
      targetId: run.id,
      createdAt: run.startedAt
    });
  }

  items.sort((a, b) => {
    const byRisk = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    if (byRisk !== 0) return byRisk;
    return b.createdAt.localeCompare(a.createdAt); // newest first
  });

  const counts: OpsRiskQueueCounts = {
    total: items.length,
    high: items.filter((item) => item.riskLevel === "high").length,
    medium: items.filter((item) => item.riskLevel === "medium").length,
    low: items.filter((item) => item.riskLevel === "low").length,
    byKind: {
      agent_action_approval: 0,
      agent_run_review: 0,
      ngo_verification: 0,
      ngo_proof_expiring: 0,
      company_verification: 0,
      listing_review: 0,
      scheduler_job_failure: 0
    }
  };
  for (const item of items) counts.byKind[item.kind] += 1;

  return { items, counts };
}

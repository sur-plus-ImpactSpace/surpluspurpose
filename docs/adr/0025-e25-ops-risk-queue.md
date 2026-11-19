# ADR 0025: E25 Ops Risk / Audit Queue

Date: 2026-06-30

## Status

In progress — step 1 (domain projection) landed.

## Context

Ops/admins need one place that answers "what must a human review right now"
instead of scanning agent runs, NGO verification and listing flags separately.
This keeps the agent review boundary (ADR 0007) and the verification flow
visible and actionable, and feeds the audit story without new infrastructure.

Security stays proportionate: this is a read-only projection over data the admin
actor is already authorized to see. No new write paths, no new privileges.

## Decision

Model the queue as a pure, deterministic domain projection
`buildOpsRiskQueue(data)` in `packages/domain/src/ops-risk-queue.ts`, returning a
risk-sorted `OpsRiskItem[]` plus counts. One canonical place to decide "what is
an open ops item", reused by any surface (ops cockpit, later an API route).

Sources and risk mapping:

- Agent proposed actions still `pending` → risk = the action's own `riskLevel`
  (these are the human-approval gate from the agent review boundary).
- Agent runs `needs_approval` with no pending actions → `medium` (orphan catch,
  avoids double-listing the common case).
- NGOs in `verification_pending` / `review` → `medium`; `pending_info` → `low`.
  Terminal/inactive states (`onboarding`, `verified`, `rejected`) are excluded.
- Listings with non-empty `reviewFlags` → `high` if any flag mentions "high"
  (e.g. `high_value`), else `medium`.

Sort: risk band (high → medium → low), then newest `createdAt` first.

## Implementation

- `packages/domain/src/ops-risk-queue.ts` — types + `buildOpsRiskQueue`.
- `packages/domain/src/ops-risk-queue.test.ts` — prioritization, counts, de-dup,
  and exclusion coverage.
- Re-exported from `packages/domain/src/index.ts`.

## Next steps (not in this step)

- Read-only admin API endpoint exposing the queue for the actor (ops/admin only),
  declared in the versioned API contract with a read rate-limit policy.
- Ops cockpit UI section rendering the queue with risk badges and deep links.

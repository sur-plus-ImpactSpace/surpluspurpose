# ADR 0026: Match quota counting — trigger state and window

Date: 2026-07-03

## Status

Accepted (founder decision, 2026-07-03). Enforcement lands with C1
(`transition_match` RPC); until then the preview repository keeps its
calendar-year approximation.

## Context

Seed includes 12 matches per year, Tree is unlimited. The entitlement metric is
matches per year (not listings), server-enforced. Two open product decisions
blocked the C1 SQL implementation, because the RPC hard-codes both:

1. Which match state consumes one unit of quota?
2. Over which window is the quota measured?

## Decision

**Trigger state: `both_confirmed`.** A match counts against the quota at the
moment both sides have confirmed. Rationale: it is the same state that unlocks
NGO contact details (trust boundary, ADR-invariant), it is fraud-resistant
(neither side can consume quota unilaterally), and proposals declined by either
side never cost the customer anything. `MATCH_COMMITTED_STATES =
CONTACT_UNLOCK_STATES` in the domain already encodes this alignment.

**Window: contract year.** 12 months rolling from the subscription start date,
not the calendar year. Rationale: fair for customers starting mid-year or in
Q4; standard for annual SaaS plans.

Cancellations after `both_confirmed`: the unit stays consumed by default
(prevents confirm-cancel gaming). Ops may manually refund quota in justified
cases via an audited admin action — no automatic refund logic in C1.

## Consequences

- C1 `transition_match` RPC enforces the quota inside the transition to
  `both_confirmed`, atomically (count + insert in one statement, no TOCTOU).
- `companies` (or the subscription record) needs a `contract_started_at` field;
  the quota window is `[contract_started_at + n*12 months, +12 months)`.
- The preview repository's `countCommittedMatches(companyId, year)` is a
  calendar-year approximation and must be aligned with the contract-year
  window in C1 (or explicitly kept as preview-only simplification).
- Dashboard metric "Matches x/12" should eventually show the window end date
  ("resets 14 Mar 2027") so customers understand the boundary.

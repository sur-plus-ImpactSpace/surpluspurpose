# ADR 0034: Donation case confirmation gate (REQ-CORP-02)

Date: 2026-11-16

## Status

Accepted — Phase 1 M2 (second slice). Builds on ADR 0033.

## Context

A corporate can build inventory on a donation case (CORP-01), but Ops must not
allocate positions until the company explicitly confirms the list. Edits after
confirm must reopen the gate so allocation never silently uses stale inventory.

## Decision

1. **Confirm** is an explicit corporate (or Ops-on-behalf) action on a case that
   already has at least one position and is not yet confirmed.
2. Confirm sets `donation_cases.confirmed_at`, advances `step` to **4
   (allocation)**, marks every `ready` position as `confirmed`, and writes
   `donation_case.confirmed` to the audit trail.
3. **Allocation is gated** on `confirmed_at is not null`. Domain helper
   `assertDonationCaseAllocatable` and SQL `donation_case_is_confirmed` exist
   for MATCH-09 RPCs; until those land, the helpers are the contract.
4. **Reopen on inventory change:** adding or importing positions while
   `confirmed_at` is set clears `confirmed_at`, sets `step` back to **2
   (inventory)**, moves `confirmed` positions back to `ready`, and audits
   `donation_case.confirmation_reopened`. When MATCH-09 allocations exist,
   that reopen audit is the signal to flag / refresh affected allocations.
5. Confirm is idempotent for an already-confirmed case (`already_confirmed`).

## Consequences

- Corporate UI shows Confirm inventory when unconfirmed and positions exist.
- MATCH-09 must call `donation_case_is_confirmed` / the domain assert before
  creating allocations — no separate status field.
- Position *edit* (not only add/import) will reuse the same reopen helper when
  that mutation is added.

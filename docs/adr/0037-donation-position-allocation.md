# ADR 0037: Allocation per position + organisation (REQ-MATCH-09)

Date: 2026-11-18

## Status

Accepted — Phase 1 M4. Builds on ADR 0033 / 0034.

## Context

Phase 1 needs one donation case with many positions, then allocations of
quantity to organisations — not one listing per SKU. Matching remains
listing-centric until a later model migration; this slice adds the allocation
entity beside the case model so Ops/corporate can allocate confirmed inventory
and NGOs can release claims without Excel.

Open founder question (“what counts as one match”) stays open for quota; this
ADR follows the roadmap proposal for the allocation unit only: one allocation
to one organisation within a case. Contract-year quota continues to consume at
`both_confirmed` on listing matches (ADR 0026) until that migration.

## Decision

1. **Entity:** `donation_allocations` binds `position_id` + `ngo_id` +
   `quantity` + `state` (`active` | `released`). `case_id` is denormalised for
   listing and RLS.
2. **Confirm gate:** create requires `assertDonationCaseAllocatable` /
   `donation_case_is_confirmed`. No second gate.
3. **Quantity cap:** server enforces
   `sum(active allocated qty for position) ≤ position.quantity` with a row lock
   on the position (preview repo + `create_donation_allocation` RPC).
4. **Actors:** **only Ops creates** allocations (founder decision 2026-11-19,
   migration 0073); the owning company sees its case's claims read-only. NGO
   (own allocation) or Ops release. NGO must be verified (`ngo_is_verified`);
   the case's company must be verified (`company_is_verified`, 0072) like every
   other case RPC. Corporate cannot read NGOs before a match (RLS), so claims
   show "Verified organisation" instead of a name on the company side.
5. **Written release:** release requires a non-empty `release_note`; state →
   `released`, quantity returns to the pool; audited as
   `donation_allocation.released`. Create audits `donation_allocation.created`.
6. **Position state:** first active allocation moves `confirmed` → `allocated`;
   last release moves `allocated` → `confirmed` when the case is still
   allocatable. Inventory reopen (ADR 0034) also returns `allocated` → `ready`
   and leaves active allocation rows for Ops to refresh/release. Re-confirm
   restores `allocated` (not `confirmed`) for positions that kept active claims
   (0072).
7. **Label snapshot (0071):** create copies `position_model` and `case_title`
   onto the allocation. The NGO reads its own allocations but not
   positions/cases (the case row holds company contact data), so labels travel
   with the allocation instead of widening RLS.
8. **Dual runtime:** preview repository + security-definer RPCs; missing RPC →
   `persistence_unavailable` (503).
9. **Out of scope:** MATCH-10 delivery mode / part-deliveries; listing→case
   cutover; NGO-04 per-position receipt; changing quota counting.

## Consequences

- `/cases/[caseId]` shows the allocate form to Ops and a read-only claim list
  to the owning company once confirmed;
  Ops reaches every case from a **Cases** sidebar entry (`/cases` lists all
  cases with their company for admin/editor).
- NGO cockpit shows active claims with a written-release control, also on the
  new-workspace screen (an NGO can be allocated to before it posts a need).
- REQ-NGO-04 and MATCH-10 can hang off allocation ids next.

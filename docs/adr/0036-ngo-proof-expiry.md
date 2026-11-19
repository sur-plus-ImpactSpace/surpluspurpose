# ADR 0036: NGO proof expiry + reminders (REQ-NGO-06)

Date: 2026-11-17

## Status

Accepted — Phase 1 M3. Implements the Phase 1 requirements brief for REQ-NGO-06
(plain + explained editions). Overrides the narrower Kriterienkatalog §D
wording that only blocked certificate countersign.

## Context

A tax-exemption notice is not permanent. If verification is treated as a
one-off, the platform can keep creating new matches against organisations whose
status is no longer evidenced. Public-law bodies have no Freistellungsbescheid
and need a separate proof path (ADR 0030).

## Decision

1. Store **notice date** + **assessment period (years)** on `ngos`. Derive
   `proof_valid_until = notice_date + years`. Never accept a free-floating
   “valid until” alone.
2. Ops sets those fields on **approve / renew**. UI defaults 3 and 5 years; the
   exact AO 3-vs-5 rule remains a tax-advisor confirmation (Section 6).
3. **public_body**: no notice, no period, no expiry job. `freier_traeger` and
   other notice-based types use the same expiry model.
4. Scheduler (via `run_scheduled_job`):
   - `warn_expiring_ngo_proofs` — 60 days before derived expiry → notify NGO + Ops
   - `expire_ngo_proofs` — on/after expiry → demote to `verification_pending`,
     audit, notify
5. **Gate:** suspended verification blocks **new promises** (`propose_match` /
   `ngo_is_verified`). Existing matches continue.
6. Ops `/ops/ngos` shows validity / expiring / expired; expiring NGOs appear in
   the risk queue as `ngo_proof_expiring`.

## Consequences

- `set_ngo_verification` gains optional proof fields; approve for notice-based
  orgs raises `proof_validity_required` when they are missing.
- Grandfathered verified rows with null `proof_valid_until` stay match-eligible
  until Ops records a notice on renew.
- Register-check-as-recorded-step (explained brief) stays a follow-up.

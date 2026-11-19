# ADR 0032: Ops admin vs editor (REQ-OPS-14)

Date: 2026-11-11

## Status

Accepted — Phase 1 M0.

## Context

Phase 1 needs two roles inside Ops. Today the schema only has
`corporate | ngo | admin`. Day-to-day verification and matching work should not
require the same privileges as plan changes or Ops roster management. AAL2
(REQ-NFR-03 / ADR 0006) must apply to both Ops roles.

## Decision

1. Add `editor` to `user_role`. Both `admin` and `editor` are org-unbound.
2. SQL helpers: `is_ops()` (admin|editor at aal2) and `is_ops_admin()` (admin
   at aal2). `current_role_of()` returns NULL for either Ops role below aal2.
3. RLS and day-to-day Ops RPCs (verify, propose/fail/ship matches, risk queue)
   gate on `is_ops()`. Platform config RPCs (`set_company_plan`,
   `set_co2_factor`) gate on `is_ops_admin()`.
4. Domain mirrors the same split via `isOpsRole` / `isOpsAdminRole`. Preview
   seed includes `usr-editor-ops`.
5. UI: Ops shell accepts either role; `/ops/admins` and plan/factor writes stay
   admin-only. Audit `actor_role` column deferred.

## Consequences

- Editors can run the matching loop without changing paid plans.
- Promoting someone to `editor` is a direct `users.role` write (or later invite
  flow); this ADR does not add an editor-invite RPC.
- Existing admin accounts keep full rights.

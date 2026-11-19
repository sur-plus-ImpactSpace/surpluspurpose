# ADR 0024: E24 Ops bootstrap UI

Date: 2026-06-27

## Status

Accepted for MVP operations.

## Context

E16 added `POST /api/admin/bootstrap` for first-admin setup. The route is
properly guarded by Supabase Auth, an allowlisted email, a server-configured
bootstrap token and service-role writes. After E22 and E23, Ops has a clear
entry route and role guard, but the first-admin workflow still requires a manual
API call.

## Decision

Add `/ops/bootstrap` as a minimal operational UI:

- Reuse the existing Supabase session controls.
- Submit the current Supabase access token as the authorization bearer.
- Submit the bootstrap token only as `x-surplus-bootstrap-token`.
- Clear the bootstrap token after a successful response.
- Link to `/ops` only after bootstrap succeeds or the user is already admin.

## Consequences

The first Ops account can be created without direct database editing or a custom
curl command. The API remains the security boundary; the UI only makes the
existing guarded flow operable.

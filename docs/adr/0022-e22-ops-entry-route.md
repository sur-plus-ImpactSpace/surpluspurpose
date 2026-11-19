# ADR 0022: E22 sur.plus Ops entry route

Date: 2026-06-27

## Status

Accepted for MVP operations.

## Context

The admin/Ops dashboard was reachable in preview through `/?role=admin`. That
works technically, but it is not a clear product entry point. A state-of-the-art
admin surface should not rely on a hidden URL as a security mechanism. Security
comes from authenticated role resolution, route/API guards and Supabase RLS.

## Decision

Add `/ops` as the explicit sur.plus Ops entry route:

- In preview, `/ops` prefers the seeded admin actor.
- With a real Supabase session, the authenticated user id still wins. A
  Corporate or NGO user cannot become admin by opening `/ops`.
- The existing preview role switch links sur.plus Ops to `/ops`.
- The main dashboard implementation stays shared, so Ops does not drift into a
  parallel demo-only UI.

## Consequences

sur.plus has a clear operational entry point without pretending that obscurity
is access control. A later hardening step can add explicit admin-only route
copy, MFA requirements and audit alerts once real production auth policy is
enabled.

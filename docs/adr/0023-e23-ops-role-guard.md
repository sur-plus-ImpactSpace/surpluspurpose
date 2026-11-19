# ADR 0023: E23 Ops role guard

Date: 2026-06-27

## Status

Accepted for MVP operations.

## Context

E22 added `/ops` as a clear sur.plus Ops entry route. The route preferred the
admin preview actor, but with a real Supabase session the authenticated user id
still wins. That is the correct security posture, but it can create confusing UX:
a Corporate or NGO user opening `/ops` should not see their own workspace inside
an Ops URL.

## Decision

Add an explicit role guard for shared dashboard entries:

- `/ops` passes `requiredRole: "admin"` to the shared dashboard page.
- If the resolved actor is not admin, the page renders an access-boundary view
  instead of rendering the wrong dashboard under `/ops`.
- The guard explains that the URL does not grant additional permissions.
- Auth, API checks and Supabase RLS remain the actual security controls.

## Consequences

Ops now has a clearer fail-closed experience without duplicating the dashboard
implementation. A future production policy can layer MFA and admin audit alerts
on the same entry boundary.

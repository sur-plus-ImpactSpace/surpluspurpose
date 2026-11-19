# ADR 0016: E16 invite delivery and admin bootstrap

Date: 2026-06-26

## Status

Accepted for MVP operations.

## Context

E15 closed the invitation acceptance path, but the MVP still needed an operational
way to deliver invite links and create the first sur.plus admin without manual
database edits. The admin dashboard also needed visibility into workspace invite
state.

## Decision

Add three operational boundaries:

- Invitation creation now attempts server-side email delivery after the invite
  row is created.
- Delivery uses `RESEND_API_KEY` when configured, or a generic
  `SURPLUS_INVITE_WEBHOOK_URL` worker. Without a provider, the API keeps the
  manual invite URL in the response for controlled setup.
- In production, if delivery succeeds, the raw acceptance token and URL are not
  echoed back in the response.
- Add `POST /api/admin/bootstrap` for first-admin setup. It requires Supabase
  Auth, a bootstrap secret, an allowlisted admin email, and the server-only
  Supabase service role key.
- Add an Admin dashboard invitations panel with role, organization and
  pending/accepted state.

## Consequences

sur.plus can now invite users through a real delivery boundary, inspect invite
state in Ops, and bootstrap an admin without direct database editing. Email
template polish and provider-specific observability remain later slices.

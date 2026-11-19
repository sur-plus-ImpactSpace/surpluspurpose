# ADR 0015: E15 invitation provisioning boundary

Date: 2026-06-26

## Status

Accepted for the authenticated onboarding path.

## Context

E14 made missing workspace profiles safe and visible, but there was still no
production-shaped path from an invitation to a provisioned `users` profile. A
valid Supabase Auth user needed an explicit, auditable way to join the correct
Corporate or NGO workspace without falling back to demo data.

## Decision

Add a token-based invitation acceptance boundary:

- Invitation creation generates a high-entropy acceptance token in the route
  handler and stores only the SHA-256 hash in Supabase.
- Invitation responses include an acceptance URL for the MVP. A later email
  slice can send that URL instead of showing it in the response.
- `accept_invitation(token, fullName)` runs as a Supabase RPC and creates the
  `users` profile for the current Supabase Auth user.
- The RPC binds acceptance to the Auth user's email, revalidates Corporate seat
  limits, marks the invitation as accepted, and writes an audit event.
- The pending workspace screen can activate `?invite=...` after sign-in.
- Magic-link sign-in preserves the current URL so invite tokens survive the
  authentication round trip.

## Consequences

The MVP now has a closed onboarding loop for invited Corporate and NGO users:
invite, sign in, accept, provision, reload into the correct dashboard. Admin
bootstrap and real email delivery remain separate operational slices.

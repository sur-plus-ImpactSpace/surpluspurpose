# ADR 0018: E18 invitation revoke governance

Date: 2026-06-26

## Status

Accepted for MVP operations.

## Context

E17 made workspace invitations creatable from the dashboard. A production access
flow also needs a way to invalidate pending invitations when an email was typed
wrong, a contact leaves the organization, or an invite should no longer consume
Corporate seat capacity.

Resend looks similar from the UI, but it is a different security problem:
sur.plus stores only an acceptance token hash. Re-sending the same link would
require storing a plaintext secret or adding a token-rotation flow.

## Decision

Add invitation revocation before resend:

- Add a single invitation mutation operation, `revoke`.
- Keep the route idempotent and rate-limited with
  `POST /api/invitations/:invitationId/revoke`.
- Let Corporate and NGO users revoke pending invitations in their own workspace.
- Let sur.plus Ops revoke any pending Corporate or NGO invitation.
- In Supabase, enforce the same checks in a `revoke_invitation(uuid)` RPC and
  clear `acceptance_token_hash` when an invite is revoked.
- Add a two-step dashboard control so revocation is deliberate.

## Consequences

Pending access can be safely withdrawn and pending Corporate seats are released.
Resend remains a later slice and should rotate the acceptance token rather than
reuse or persist plaintext invitation secrets.

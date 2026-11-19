# ADR 0019: E19 invitation resend token rotation

Date: 2026-06-26

## Status

Accepted for MVP operations.

## Context

E18 added invitation revocation and intentionally deferred resend. Re-sending an
existing invite link would either require storing plaintext acceptance tokens or
reusing a potentially exposed secret. The current model stores only token
hashes, which is the right security posture for production.

## Decision

Implement resend as token rotation:

- Add a single `resend` invitation mutation beside `revoke`.
- `POST /api/invitations/:invitationId/resend` remains idempotent and
  rate-limited.
- On resend, the server creates a new acceptance token and stores only its hash.
- Supabase enforces pending-only, actor-scoped resend through
  `resend_invitation(uuid, text)`.
- Email delivery uses the existing invitation delivery provider boundary.
- In production, raw acceptance links stay hidden when delivery succeeds; when
  delivery is not configured, the route exposes a fallback link for controlled
  setup.

## Consequences

sur.plus can resend pending invitations without persisting plaintext secrets or
keeping old invite links alive. Delivery analytics are still provider-level for
now; a later slice should persist delivery attempts if Ops needs a searchable
mail audit trail.

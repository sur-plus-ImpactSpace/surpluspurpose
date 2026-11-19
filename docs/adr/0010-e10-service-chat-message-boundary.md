# ADR 0010: E10 service chat message boundary

Date: 2026-06-26

## Status

Accepted for the first E10 slice.

## Context

Corporate and NGO workspaces need a low-friction service channel with sur.plus
for logistics, documentation and contact-unlock decisions. The chat must not
become a parallel data store, and it must not bypass match visibility rules.

Realtime delivery is still required for the full chat experience, but the first
production-safe slice should persist messages through the same API, RLS,
idempotency and audit controls used by the rest of the MVP.

## Decision

Add `GET/POST /api/matches/:matchId/messages` as the service-chat boundary:

- `GET` returns messages visible to the current actor.
- `POST` requires an idempotency key, validates a bounded message body and
  creates a customer-visible message inside the match visibility boundary.
- Preview routes use the shared route workspace, rate-limit and idempotency
  guards.
- Supabase runtime uses a `create_message(...)` RPC that checks `auth.uid()`,
  `current_role_of()` and `can_access_match(...)`, writes the message and emits
  a `message.created` audit event.
- The dashboard renders a small composer in the service panel for Corporate and
  NGO roles.

## Consequences

E10 is not the full WebSocket chat. Supabase Realtime can subscribe to the
already-persisted `messages` table in the next slice. Reconnect/catch-up stays
simple because Postgres remains the source of truth.

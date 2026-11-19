# ADR 0002: Chat realtime direction

Date: 2026-06-24

## Status

Proposed for the future chat epic.

## Context

Marketplace messaging needs a live connection between corporate and NGO users.
The hard parts are low-latency delivery, reconnect behavior, and preserving the
trust boundary around match visibility and contact data.

## Decision

Use WebSocket-backed realtime delivery, with Postgres `messages` as the source of
truth. Supabase Realtime is the preferred first implementation because it uses
WebSockets while keeping authorization tied to Supabase Auth and RLS.

## Constraints

- Message persistence happens before realtime fan-out.
- RLS on `messages` must enforce match-party visibility.
- Reconnect must catch up from persisted messages, not from volatile socket
  state.
- Presence and typing indicators may be ephemeral.
- Chat must not bypass contact-data unlock rules.

## Consequences

E0 does not implement chat. E1/E2 should keep `messages` modeled so a future
chat feature can attach realtime subscriptions without introducing a second
source of truth.

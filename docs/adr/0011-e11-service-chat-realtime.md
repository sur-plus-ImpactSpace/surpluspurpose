# ADR 0011: E11 service chat realtime catch-up

Date: 2026-06-26

## Status

Accepted for the first realtime slice.

## Context

E10 introduced durable match messages through the API and Supabase RPC. The next
step is live delivery, but the chat must keep Postgres as the source of truth and
must not weaken the match visibility boundary.

## Decision

Add an optional Supabase Realtime client path to the service chat:

- Preview workspaces stay on the persisted HTTP route only.
- Supabase workspaces receive a browser-safe realtime config only when a public
  Supabase URL and anon key are available.
- Browser mutations and catch-up reads attach the current Supabase Auth session
  token when available.
- The client subscribes to `postgres_changes` inserts on `public.messages`,
  filtered by the current `match_id`.
- Reconnect/catch-up re-reads the persisted message list through the route,
  rather than trusting socket state as the canonical source.

## Consequences

Realtime is production-gated by Supabase Auth and RLS. Without a valid browser
session the composer still renders, but Supabase route mutations will return an
auth error instead of falling back to unsafe anonymous writes.

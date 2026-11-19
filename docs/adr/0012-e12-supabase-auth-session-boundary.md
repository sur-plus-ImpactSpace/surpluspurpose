# ADR 0012: E12 Supabase auth session boundary

Date: 2026-06-26

## Status

Accepted for the first authenticated app slice.

## Context

E10 and E11 made service chat durable and realtime-ready, but browser mutations
still needed a clear session boundary. Preview headers are useful locally, but
production routes must resolve the actor from Supabase Auth and the provisioned
`users` profile.

## Decision

Introduce a browser Supabase client boundary and a route auth check:

- The dashboard exposes a compact Supabase Auth magic-link session control when
  public Supabase config is available.
- Client mutations use the current Supabase Auth session token when configured.
- Preview headers are only sent when no Supabase browser config exists.
- Supabase route handlers call `/auth/v1/user` first, then resolve the actor
  from the matching `users.id` profile.
- A valid Auth user without a provisioned workspace profile receives
  `actor_not_available` instead of falling back to another user.

## Consequences

Supabase Auth is now the production identity source for route mutations. Server
rendered workspace data can still fall back to preview until the next slice adds
SSR cookie/session hydration for fully authenticated initial page loads.

# ADR 0003: E2 Supabase persistence boundary

Date: 2026-06-24

## Status

Accepted for the first E2 slice.

## Context

The E1 app has a canonical domain model and in-memory repository seam. The next
step is real persistence without letting UI code depend directly on Supabase
table shapes or bypass match/contact visibility rules.

## Decision

Use Supabase PostgREST as the first server-side persistence adapter. The adapter
loads a repository snapshot from Supabase, maps `snake_case` rows into the
canonical domain model, and then reuses the existing repository/state-machine
rules for UI reads.

The web app chooses its data source at request time:

- Supabase when `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` and a server-side
  key are configured.
- Preview seed data when Supabase is not configured or unavailable.

The selected corporate actor is resolved centrally from the loaded `users`
table. `SURPLUS_APP_USER_ID` may pin a specific corporate user for staging.

## Consequences

This slice makes persistence deploy-safe before full login exists. It does not
yet implement Supabase Auth UI, write mutations, or realtime chat. Those should
build on the same repository boundary rather than querying tables from React
components.

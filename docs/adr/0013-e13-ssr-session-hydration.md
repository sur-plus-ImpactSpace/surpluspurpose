# ADR 0013: E13 SSR session hydration

Date: 2026-06-26

## Status

Accepted for the authenticated dashboard slice.

## Context

E12 authenticated route mutations with Supabase Auth, but the initial dashboard
render still selected a workspace from preview role hints unless the client had
already attached an access token to an API request. That created a UX gap and a
security footgun: a signed-in user could see an initial server render that did
not yet reflect their authenticated workspace.

## Decision

Use `@supabase/ssr` as the session bridge:

- The browser Supabase client now stores session state in SSR-compatible cookies.
- The dashboard server component reads the cookie-backed Supabase session before
  loading workspace data.
- Server-rendered Supabase REST reads use the authenticated user's bearer token
  with the anon key, not the service-role key.
- When a session user id is present, actor resolution is pinned to that user id.
  Role query parameters cannot change the actor.
- A valid Auth user without a provisioned `users` profile does not silently map
  to another workspace profile.
- Authenticated server reads fail closed instead of falling back to preview data.

## Consequences

The first dashboard paint can now reflect the authenticated user. Middleware is
still the correct place for proactive cookie refresh; this slice limits itself
to safe session reads in the server component. Preview mode remains available
for unauthenticated local/demo operation without public Supabase config.

# ADR 0014: E14 session refresh and provisioning state

Date: 2026-06-26

## Status

Accepted for the authenticated MVP path.

## Context

E13 allowed the dashboard server component to read the Supabase Auth session from
SSR-compatible cookies. A production app still needs the request middleware to
refresh those cookies before server rendering, otherwise sessions can drift
between browser and server. The UX also needed a clear state for a valid Auth
user that has not yet been provisioned into a sur.plus workspace profile.

## Decision

Extend the existing Next proxy, which already owns CSP nonce creation, to also
run `@supabase/ssr` session refresh:

- Keep one proxy path for CSP and Supabase cookies.
- Refresh the Supabase user session before page rendering when public Supabase
  config is present.
- Preserve the per-request CSP nonce when cookies are updated.
- Render a dedicated workspace-pending screen for valid Auth users without a
  matching `users` profile.
- Keep authenticated profile misses fail-closed with no preview data fallback.

## Consequences

The app now has a production-shaped Auth lifecycle: browser login writes cookies,
the proxy refreshes them, SSR reads the session, and workspace access remains
blocked until the Auth user is explicitly provisioned. Invitation/provisioning
automation is still a later slice; this slice makes the missing-profile state
visible and safe.

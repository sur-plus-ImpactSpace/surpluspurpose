# ADR 0017: E17 dashboard invitation creation

Date: 2026-06-26

## Status

Accepted for MVP operations.

## Context

E15 and E16 made invitations provisionable and deliverable, but invite creation
still lived only behind the API. That left the dashboard unable to create real
workspace access without a manual API call. The registration surface should stay
simple and should not expose plan, verification or internal operational detail
before a user has a workspace context.

## Decision

Add a dashboard invitation panel on top of the existing `POST /api/invitations`
boundary:

- Corporate users can invite Corporate colleagues into their own workspace.
- NGO users can invite NGO colleagues into their own workspace.
- sur.plus Ops can create Corporate or NGO invitations for existing
  organizations.
- The client sends an idempotency key, uses the authenticated Supabase session
  when configured, and falls back to the preview actor header only in preview
  mode.
- The API remains the authority for actor checks, seat limits, duplicate pending
  invitations, rate limits, token generation and delivery.
- If email delivery is not configured, the UI shows the fallback invite link for
  controlled setup. If delivery succeeds in production, the API continues to
  hide raw invitation secrets.

## Consequences

Workspace access can now be operated from the product itself without expanding
the public registration flow. Later slices should add resend/revoke actions,
organization creation from Ops, and provider-level delivery observability.

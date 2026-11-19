# ADR 0008: E3 entitlement enforcement

Date: 2026-06-25

## Status

Accepted for the first E3 enforcement slice.

## Context

Seed and Tree are product plans for platform usage, not listing limits. Seed
allows 12 committed matches per contract year. Tree is uncapped. The important
trust boundary is that this cannot be a UI-only upsell rule; it must be enforced
where match state changes become durable.

## Decision

The repository enforces match quota when a match moves from a non-committed
state into a committed state. In the canonical state machine, this first happens
at `both_confirmed`.

- Listing creation remains uncapped by match allowance.
- Seed is blocked once committed matches for the company/year reach 12.
- Tree has `matchesPerYear = null` and is not blocked.
- The transition fails with `match_quota_exceeded` and leaves match state
  unchanged.

## Consequences

- The upgrade signal can be rendered in the UI, but the server boundary is the
  source of truth.
- Supabase Edge Functions and future route handlers must call the repository
  transition method instead of updating match rows directly.
- Seat enforcement uses the same source of truth: active corporate users plus
  pending corporate invitations count against `PLAN_ENTITLEMENTS.userSeats`.
- Pending invitations reserve seats so teams cannot bypass limits by sending
  multiple outstanding invites.
- Invitation rows are org-scoped with `company_id`/`ngo_id`; `org_name` is
  display metadata only.
- `POST /api/invitations` uses a shared command parser and idempotency key
  requirement before calling `repo.invitations.create(...)`.

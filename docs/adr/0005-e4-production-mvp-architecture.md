# ADR 0005: E4 production MVP architecture contract

Date: 2026-06-25

## Status

Accepted for the first E4 slice.

## Context

sur.plus is moving from a frontend-only behavioral prototype to a typed,
server-enforced marketplace. The product needs to support many organizations
without weakening the core trust boundary:

- corporate and NGO data is scoped by role and organization;
- match state transitions are server-enforced;
- match quota is counted on committed matches, not listings;
- AI can propose work but cannot execute without human approval;
- signature status comes from DocuSeal webhooks only;
- every compliance-relevant mutation writes audit history.

The static app under `05_Landingpage/Online/app` remains a preview/reference
surface. Production code lives in the monorepo workspace.

## Decision

E4 locks the production MVP architecture before adding more product surface.
The platform is split into strict boundaries:

| Layer | Path | Responsibility |
| --- | --- | --- |
| Landing page / preview | `05_Landingpage/Online` | Public website and static preview only. Not a production data boundary. |
| Web app shell | `apps/web/app` | Next.js App Router UI, server components for reads, client components only for forms/realtime. |
| Domain contract | `packages/domain/src` | Canonical model, repository interface, command semantics, API contract and invariant tests. |
| Persistence | `supabase/migrations` | Postgres schema, RLS, indexes, views, triggers/functions. |
| Edge/API boundary | `supabase/functions` and `apps/web/app/api` | Thin route handlers that authenticate, validate, call domain/repository commands and audit. |
| Documents/signature | Supabase Storage + DocuSeal | Documents are metadata + storage paths; envelope state is webhook-sourced. |

No UI component may talk directly to Supabase tables. Reads go through server
loaders/repository adapters. Mutations go through route handlers or Edge
Functions with actor context, idempotency and audit.

## API contract

`packages/domain/src/api-contract.ts` is the versioned MVP API contract. It is
intentionally code, not prose, so tests can prevent unsafe endpoints.

Production mutations must satisfy one of these protections:

- authenticated user mutation: idempotency key + audit action;
- external webhook: provider signature verification + audit action.

Initial endpoints:

- `GET /api/workspace`
- `GET /api/matches`
- `POST /api/matches/:matchId/transition`
- `GET /api/matches/:matchId/messages`
- `POST /api/matches/:matchId/messages`
- `POST /api/listings`
- `POST /api/needs`
- `POST /api/agent-runs`
- `POST /api/agent-actions/:actionId/approve`
- `POST /api/agent-actions/:actionId/execute`
- `POST /api/documents`
- `POST /api/signature-envelopes`
- `POST /api/webhooks/docuseal`
- `GET /api/reports/csrd`

## Database scaling decisions

The initial schema now includes indexes for the first high-volume access
patterns:

- org-scoped workspace reads: users, listings, needs, matches;
- match lifecycle and committed usage queries;
- realtime message thread reads by `match_id, created_at`;
- agent approval queues by org/status;
- document libraries by org/status/match;
- DocuSeal webhook de-duplication by provider external id.

At larger scale, add these without changing the product contract:

- cursor pagination on all list endpoints;
- monthly partitioning for `audit_events` and optionally `messages`;
- background/outbox jobs for report generation, emails and document rendering;
- PgBouncer/Supabase pooling for serverless concurrency;
- Storage CDN for PDFs/assets;
- per-actor rate limits on mutation endpoints.

## UI architecture

The production app should organize screens by role and feature, not by one
large page file:

```text
apps/web/app/
  (corporate)/
    listings/
    matches/
    reports/
  (ngo)/
    needs/
    matches/
    impact/
  (admin)/
    matching/
    verification/
    documents/
  api/
    ...
  lib/
    auth-context.ts
    repository.ts
    idempotency.ts
    audit.ts
```

Server components load scoped read models. Client components are limited to
interactive forms, optimistic thread updates and realtime subscriptions. The
UI is not a security boundary.

## Consequences

- The next implementation slices should add route handlers/Edge Functions from
  the API contract one at a time.
- Every new mutation must have an invariant test before UI wiring.
- The prototype can continue to be useful for copy/behavior checks, but it must
  not become the production platform.
- Main CI must stay green before adding new E4/E5 product work.

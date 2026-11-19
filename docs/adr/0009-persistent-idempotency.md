# ADR 0009: Persistent idempotency for mutations

Date: 2026-06-25

## Status

Accepted for the first persistent idempotency slice.

## Context

Authenticated mutations can be retried by browsers, mobile networks, serverless
platforms and clients. Preview routes currently require an idempotency key, but
production needs a persistent replay boundary so retries do not create duplicate
agent runs, invitations, messages or document actions.

## Decision

Add `idempotency_keys` to Postgres:

- uniqueness is scoped to `(actor_id, endpoint_id, key)`;
- `request_hash` records the SHA-256 hash of actor, endpoint and canonical body;
- `processing`, `completed` and `failed` are explicit states;
- completed records must store `response_status`, `response_body` and
  `completed_at`;
- records expire after 24 hours by default and are indexed for cleanup.

The domain package exposes a shared `createIdempotencyRequestHash(...)` helper
so Next route handlers and Supabase Edge Functions compute the same request
hash.

Next route handlers use a shared route guard for preview-safe idempotency. By
default the guard stores completed responses in memory, scoped by actor,
endpoint and idempotency key. When `SURPLUS_PERSISTENT_IDEMPOTENCY=true` is
set together with Supabase URL/key configuration and a bearer token, the guard
reserves and completes keys through the Postgres RPCs instead.

Postgres exposes two authenticated RPCs:

- `reserve_idempotency_key(...)` atomically reserves a key or returns `replay`,
  `processing`, `failed` or `conflict`;
- `complete_idempotency_key(...)` stores the final response for replay.

## Consequences

- Retrying the same mutation with the same key can return the stored response.
- Reusing the same key with a different request hash must be rejected by the
  Edge/API layer before side effects.
- Edge Functions should reserve the idempotency row before writing business
  data, then mark it completed with the serialized response.

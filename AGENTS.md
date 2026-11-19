# AGENTS.md — working on sur.plus

Guidance for any coding agent (Codex, Claude, …) and human contributors.
Read this before writing code. ADRs in `docs/adr/` are the decision log.

## What this is

Matching platform Corporate ↔ NGO with CSRD/impact documentation.
Naming: only **"Corporate"** and **"NGO"** — never "donor"/"recipient".
Plans: **Seed** and **Tree**; entitlement metric = **matches per contract year**
(not listings), server-enforced. ADR 0026: quota is consumed at
`both_confirmed`, window rolls with the contract year, cancellation does not
refund.

## Layout

- `apps/web` — Next.js App Router + TypeScript + Tailwind
- `packages/domain` — pure domain: model, repository (in-memory preview impl),
  command parsers, projections. No React, no Next imports.
- `supabase/migrations` — SQL schema + RPCs; `supabase/tests` — pgTAP
- `docs/adr` — one ADR per epic/decision (E0…, ADR 0026 …)
- `05_Landingpage/` — landing page (the legacy `/app` prototype is retired;
  the product app is `apps/web`, deployed as its own Netlify site)

## Two runtimes, one contract

Every route works in two modes, decided per request in
`apps/web/app/api/_lib/route-workspace.ts`:

- **preview**: in-memory repository, seeded via `createSeedData()`. Actor from
  `x-surplus-preview-user-id` header. Preview mutations in production are
  blocked unless `SURPLUS_ALLOW_PREVIEW_MUTATIONS=true`.
- **supabase**: real Postgres via REST/RPC, actor from the JWT. Writes go
  through Postgres RPCs (security definer) — never raw table writes from
  routes. If an RPC does not exist yet, the route returns
  `persistence_unavailable` (503) for that runtime.

Preview seed users: `usr-corporate-acme` (co-acme), `usr-ngo-kleiderkammer`
(ngo-kleiderkammer), `usr-admin-ops`, `usr-editor-ops`. Seed matches:
`mat-thinkpads` (proposed), `mat-jackets` (both_confirmed). Ops roles:
`admin` (plans/CO₂/roster) and `editor` (day-to-day Ops); both need AAL2.

## Patterns — mirror these exactly

- **Mutation route**: template
  `apps/web/app/api/matches/[matchId]/messages/route.ts`. Flow:
  `parse*Command(headers, body)` → `loadRouteWorkspace(request)` →
  `enforceRouteRateLimit` → `reserveRouteIdempotency` → repository call or
  `*WithSupabaseRpc` → `routeJson`. Every mutation requires an
  `idempotency-key` header.
- **Command parser**: template `packages/domain/src/message-api.ts` /
  `listing-api.ts`. Pure shape validation + idempotency key only; business
  rules live in the repository. New file + alphabetical export in `index.ts`.
- **Repository create**: template `invitations.create` / `listings.create` in
  `repository.ts` (actor guard → validate → `x-${len+1}` id + `nowIso()` →
  push → `recordAudit` → result object `{ ok, ... } | { ok: false, reason }`).
- **Client component**: template `ServiceChatComposer.tsx` /
  `MatchConfirmControls.tsx` (`"use client"`, `browserRouteHeaders({ config,
  previewUserId })`, fetch with idempotency key, `useRouter().refresh()`).
- **SQL RPC**: template `create_invitation` in migration 0001 and
  `transition_match` in 0002 (plpgsql, security definer,
  `set search_path = public`, `raise exception '<reason>'` with the exact
  error reasons the route maps, audit insert, row lock via `for update` when
  counting + writing must be atomic).
- **API contract**: `packages/domain/src/api-contract.ts` declares endpoints
  (id, actors, audit action, rate-limit policy) — check it before adding a
  route; many endpoints are declared but not yet implemented.

## Invariants — never break

1. Trust boundary server-side (RLS): full NGO contact data only from
   `match.state >= both_confirmed`; before that `ngo_public_min`.
2. One match state machine (no second status field). States: proposed →
   ngo_confirmed → both_confirmed → in_transit → delivered → completed;
   cancelled from any non-terminal state (admin only); an unanswered
   `proposed` match expires after 14 days into the terminal state `expired`
   (system job, ADR 0028 D5, no quota used). Delivery that collapses after
   shipping ends in `failed` (Ops, `fail_match`; quota refunded unless the NGO is
   at fault), while `cancelled` only exists before shipping (ADR 0028 D4).
3. Entitlement metric = matches per contract year, enforced server-side.
4. Agent runs: proposals yes, execution only after human approval.
5. E-signature status changes only via webhook.
6. UGC/demo content is never translated (i18n covers UI chrome only).
7. Audit trail for every security/compliance-relevant mutation.
8. Production never silently serves preview data when Supabase is configured
   (fail loud; `SURPLUS_ALLOW_PREVIEW_FALLBACK=true` is the explicit opt-out).

Security is proportional: baseline (22 controls, see
`packages/domain/src/security-controls.ts`) is enough — per write add input
validation + RLS policy, do not bolt on heavyweight extras.

## Verify loop

```
pnpm --filter @surplus/domain test
pnpm --filter @surplus/domain typecheck
pnpm --filter @surplus/web typecheck
pnpm --filter @surplus/web build
```

CI (`.github/workflows/ci.yml`) runs lint + typecheck + build + test on
every PR. `eslint --max-warnings=0`: unused imports fail
the build. SQL: `supabase test db` runs `supabase/tests/*.sql` (pgTAP).

## Process

- **Git author for every commit/push:** `saadmuhammadcs <saad.muhammad.cs@gmail.com>`
  (pass via `--author`, do not change `git config`). Never add `Co-authored-by:`
  (including Cursor/agent trailers). Use this account for deployments too.
- Small verified slices, one concern per PR, `typecheck+test+build` green
  before commit. Conventional commits (`feat:`, `refactor:`, `docs:`, `test:`).
- Do not mix refactors with features.
- Phase 1 completion order and status live in
  [`docs/planning/phase1-roadmap.md`](docs/planning/phase1-roadmap.md) — update it
  when a REQ slice lands; take the **Next action** from that file.
- Landing page (surpluspurpose.com) is the single source of truth for product
  claims and pricing; if repo copy and LP disagree, flag it — do not guess.
- Open product decisions are founder calls: ask, never assume.

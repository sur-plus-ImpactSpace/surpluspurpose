# Staging runbook — M1 end-to-end login test

Goal: prove the full Supabase runtime (auth → workspace → RPC writes → RLS)
with a real login, WITHOUT touching production. Production (`surplus-app`
Netlify site, `app.surpluspurpose.com`) keeps NO Supabase env vars — that is
the deliberate gate that keeps `/login` offline until go-live.

Staging = the `staging` branch deploy of the same Netlify site
(`staging--surplus-app.netlify.app`) with branch-scoped Supabase envs.

## 1. Create the staging Supabase project (once, ~5 min)

1. supabase.com → New project, name `surplus-staging`, region EU (Frankfurt).
2. SQL editor → run, in order (0004 is required — it redefines `transition_match`
   AND adds the certificate/CSRD generation; without it a completed match produces
   no documents):
   - `supabase/migrations/0001_initial_schema.sql`
   - `supabase/migrations/0002_match_transition_rpc.sql`
   - `supabase/migrations/0003_create_listing_need_rpcs.sql`
   - `supabase/migrations/0004_completion_documents.sql`
   - `supabase/seed.staging.sql`
3. Authentication → URL Configuration:
   - Site URL: `https://staging--surplus-app.netlify.app`
   - Additional redirect URLs: `https://staging--surplus-app.netlify.app/**`
4. Note down from Project Settings → API: Project URL, `anon` key,
   `service_role` key (secret! never in git, never in NEXT_PUBLIC_*).

## 2. Netlify branch-scoped env vars (once)

Netlify → surplus-app → Environment variables. Add each var with scope
**"Branch deploys"** (or value-per-context set ONLY for branch deploys —
Production must stay empty):

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | staging project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service_role key |
| `SURPLUS_ADMIN_BOOTSTRAP_TOKEN` | long random string (e.g. `openssl rand -hex 24`) |
| `SURPLUS_ADMIN_BOOTSTRAP_EMAILS` | `florian@surpluspurpose.com` |

Danger check: after saving, confirm the Production context still shows NO
Supabase values — that is the login gate (AGENTS.md invariant 8 protects
against silent fallback, this protects against accidental go-live).

## 3. Deploy staging

> **First-time (2026-07-10):** the `staging` branch is **62 commits behind `main`** and
> `staging--surplus-app.netlify.app` currently returns "Site not found" — the branch deploy
> has never gone up. Before anything else, bring the branch current and confirm branch
> deploys are enabled:
> 1. In GitHub Desktop: switch to `staging`, `Branch → Merge into current branch → main`,
>    push. (Or terminal: `git checkout staging && git merge main && git push`.)
> 2. Netlify → surplus-app → Site configuration → Branches & deploy contexts: ensure
>    `staging` is in "Branch deploys". A branch deploy only builds after the branch is
>    pushed with deploys enabled.

To later update staging to the latest main: merge `main` into `staging` and push.
Deploy URL: `https://staging--surplus-app.netlify.app`.

## 4. The M1 click-through (the actual test)

1. Open the staging URL → `/` must redirect to `/login` (Supabase configured,
   no session). `/demo` must still work without login.
2. Sign in with the bootstrap email via magic link. After clicking the link
   you must land back in the app and be forwarded off `/login` automatically.
   Expected first state: "Workspace access pending" (auth user exists, no
   workspace profile yet).
3. Bootstrap Ops: open `/ops/bootstrap`, paste the
   `SURPLUS_ADMIN_BOOTSTRAP_TOKEN`, submit → you become the admin user, `/ops`
   shows the Ops dashboard with the seeded staging data.
4. Invite the corporate side: Ops → invitation panel → invite
   `staging-corporate@...` for company "Acme Staging GmbH". Open the invite
   link in a private window, accept, sign in → Corporate dashboard.
5. Walk the loop against the real DB:
   - Corporate: create a listing (checks `create_listing` RPC + RLS).
   - NGO (invite `staging-ngo@...` the same way): post a need, confirm the
     seeded match `proposed → ngo_confirmed`.
   - Corporate: confirm → `both_confirmed` (quota consumption! Matches
     metric must show 1/12).
   - Ops: `in_transit` → `delivered`; NGO: confirm receipt → `completed`.
6. Negative checks (5 min, worth it):
   - Corporate must NOT see NGO contact details before `both_confirmed`.
   - A second `both_confirmed` beyond the plan allowance must fail with
     `match_quota_exceeded` (set `plan_entitlements.matches_per_year = 1`
     temporarily in SQL to test cheaply, then reset).
7. Log every rough edge (copy, dead ends, errors) — that list feeds M3.

## 5. Known limitations on staging

- Invitation e-mails: without `RESEND_API_KEY` no mail is sent — use the
  invitation's accept link directly from the Ops UI/DB.
- Magic-link mails come from Supabase's built-in SMTP (rate-limited, fine
  for staging).
- `SURPLUS_ALLOW_PREVIEW_MUTATIONS` is irrelevant here (real runtime).

## Env var reference (full matrix)

App runtime: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SURPLUS_ROUTE_RUNTIME`, `SURPLUS_PERSISTENT_IDEMPOTENCY`.
Bootstrap: `SURPLUS_ADMIN_BOOTSTRAP_TOKEN`, `SURPLUS_ADMIN_BOOTSTRAP_EMAILS`.
Invitations: `RESEND_API_KEY`, `SURPLUS_INVITE_FROM_EMAIL`,
`SURPLUS_INVITE_WEBHOOK_URL`, `SURPLUS_INVITE_WEBHOOK_TOKEN`.
Demo/preview only: `SURPLUS_ALLOW_PREVIEW_MUTATIONS`,
`SURPLUS_ALLOW_PREVIEW_FALLBACK`, `SURPLUS_APP_ROLE`, `SURPLUS_APP_USER_ID`.

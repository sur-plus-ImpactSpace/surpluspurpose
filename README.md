# sur.plus

> **Every surplus has a purpose. We find it.**

sur.plus is the surplus-to-NGO infrastructure for the circular economy — connecting unused corporate resources with verified NGOs across Europe, fully documented for CSRD compliance.

🌐 **Website:** [surpluspurpose.com](https://surpluspurpose.com)
🖥️ **Product app:** [app.surpluspurpose.com](https://app.surpluspurpose.com) (public demo: `/demo`)
📧 **Contact:** service@surpluspurpose.com
👤 **Founder:** Florian Lechner, Inning am Ammersee

---

## What is sur.plus?

Companies generate billions in usable surplus every year — furniture, IT hardware, textiles — that gets destroyed while NGOs face chronic resource shortages. sur.plus is the infrastructure that connects them:

- **Matching engine** — surplus listed, needs posted, matches within 72 hours
- **CSRD-ready documentation** — audit-ready impact reports generated from real match data
- **Verified NGO network** — we are building the partner network across the EU and UK
- **Zero cost for NGOs** — always free for the receiving side

> **Status: pre-launch.** sur.plus UG (haftungsbeschränkt) is incorporated (AG München
> HRB 315904); we are onboarding the first corporate
> and NGO partners. The landing page is the single source of truth for product claims and
> pricing — if this README and the landing page disagree, the landing page wins.

---

## This repository

Private repository. It tracks the public website plus the typed platform workspace.
Internal/confidential material (business plan, legal, finance, CVs, contracts) is
intentionally excluded via a **whitelist `.gitignore`** and is never committed or pushed.

```
apps/web/                 Next.js App Router + TypeScript + Tailwind (the product app)
packages/domain/          Shared domain: model, repository, command parsers, projections
supabase/
├── migrations/           SQL schema + security-definer RPCs
├── tests/                pgTAP tests
└── seed.staging.sql      Verified staging seed
tools/smoke.mjs           Smoke suite executed by CI
docs/
├── adr/                  Architecture decision records (one per epic/decision)
├── ops/                  Runbooks (staging, landing-page chat)
├── planning/             Product backlog / dashboard roadmap
└── security/             Security notes
05_Landingpage/Online/    Landing page deploy root (see below)
```

> The numbered business folders (`01_STRATEGY` … `07_SALES`) live on disk but are
> gitignored. Root config files (`netlify.toml`, `pnpm-workspace.yaml`, `AGENTS.md`, …)
> must stay at the root — Netlify, CI and pnpm resolve them from there.

### Landing page deploy root

```
05_Landingpage/Online/
├── index.html                       English landing page
├── de/index.html                    German landing page
├── surplus_impact_calculator.html   Impact Calculator (EN)  ·  de/… (DE)
├── CSRD_Report_…  /  NGO_…          sample documents (EN + de/, HTML + PDF)
├── fonts/                           self-hosted DM Sans / DM Serif (no Google Fonts)
├── img/                             landing-page imagery (AI/representative, labelled)
├── robots.txt · sitemap.xml · 404.html · _redirects · _headers
└── netlify/functions/
    ├── send-report.js               Impact-Calculator report sender (Resend)
    └── exit-feedback.js             exit-intent feedback / launch-list capture (Resend)
```

---

## Platform workspace

```bash
pnpm install
pnpm run ci     # lint → typecheck → build → unit tests
```

Individual steps:

```bash
pnpm lint                                # eslint, --max-warnings=0
pnpm typecheck                           # tsc --noEmit across the workspace
pnpm build                               # next build (apps/web)
pnpm test                                # vitest (domain + web)
node tools/smoke.mjs --start             # demo-mode smoke suite (also run in CI)
supabase test db                         # pgTAP suite in supabase/tests
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, tests and the smoke suite on
every push to `main` and on pull requests.

### Two runtimes, one contract

Every route works in two modes, decided per request in
`apps/web/app/api/_lib/route-workspace.ts`:

- **preview** — in-memory repository seeded with example data. Powers `/demo` and works
  without Supabase. Preview mutations are blocked in production unless
  `SURPLUS_ALLOW_PREVIEW_MUTATIONS=true`.
- **supabase** — real Postgres via REST/RPC. Writes go through security-definer RPCs,
  never raw table writes.

Production never silently serves preview data when Supabase is configured — it fails loud.

### Security baseline

- API and security contracts live in `packages/domain/src/api-contract.ts` and
  `packages/domain/src/security-controls.ts`.
- Dependabot monitors npm/pnpm and GitHub Actions dependencies.
- `.github/workflows/security.yml` runs a pnpm dependency audit. CodeQL is wired in the
  same workflow but gated by the `CODEQL_ENABLED=true` repository variable until GitHub
  Code Scanning is enabled.
- The Next app emits nonce-based CSP from `apps/web/proxy.ts` and browser hardening
  headers from `apps/web/next.config.mjs`.

Privacy-first: cookieless; fonts are self-hosted on both surfaces (landing page ships
DM Sans / DM Serif directly, the app self-hosts DM Serif Display / Inter / Syne through
`next/font` at build time — no runtime Google request). Third-party widgets
(Calendly/Tally) are lazy-loaded on click. Plausible analytics is included but commented
out (activate when ready).

---

## Deploy (Netlify, Git-connected)

Two **separate** Netlify sites are built from this one repository.

| Site | Base directory | Config | Notes |
|---|---|---|---|
| `surpluspurpose.com` (landing page) | `05_Landingpage/Online` | root `netlify.toml` | publish `.`, functions in `netlify/functions` — needs a Git or CLI deploy, not drag-and-drop |
| `app.surpluspurpose.com` (product app) | `apps/web` | `apps/web/netlify.toml` | `pnpm build`, publish `.next`, `@netlify/plugin-nextjs`, Node 24 |

### Landing-page environment variables

| Variable | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | yes | Resend API key for the calculator report + exit-feedback mails |
| `REPORT_FROM` | no | Sender, default `Florian Lechner <florian@surpluspurpose.com>` |
| `REPORT_NOTIFY` | no | Internal lead-copy recipient, default `florian@surpluspurpose.com` |
| `REPORT_REPLY_TO` | no | Reply-to, default `florian@surpluspurpose.com` |

### App runtime variables

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase project URL for the app repository adapter |
| `SUPABASE_SERVICE_ROLE_KEY` | no | Server-side key for loading the repository snapshot; keep it out of the browser |
| `SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` | no | Optional read key for environments that rely on RLS-authenticated requests |
| `SURPLUS_APP_USER_ID` | no | Corporate user ID to pin the current staging workspace actor |

If Supabase variables are absent, the app intentionally falls back to preview seed data
and shows that source in the workspace header.

---

## Contributing

Read [`AGENTS.md`](./AGENTS.md) before writing code — it holds the invariants
(trust boundary, single match state machine, entitlement metric, audit trail) and the
patterns to mirror. Decisions are recorded as ADRs in `docs/adr/`.

Small verified slices, one concern per pull request, `lint + typecheck + build + test`
green before commit. Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

> **Never run `git add -A` in this repository.** iCloud creates duplicate symlinks
> (`node_modules 2`, `.pnpm-store 2`) that break `next build` in CI once committed.
> Stage explicit paths instead.

---

## Key Links

| Resource | Link |
|---|---|
| Website | [surpluspurpose.com](https://surpluspurpose.com) |
| Product app · demo | [app.surpluspurpose.com/demo](https://app.surpluspurpose.com/demo) |
| For NGOs | [surpluspurpose.com/#for-ngos](https://surpluspurpose.com) |
| For Corporates | [surpluspurpose.com/#for-companies](https://surpluspurpose.com) |
| Impact Calculator | [surpluspurpose.com/surplus_impact_calculator.html](https://surpluspurpose.com) |
| Pricing | [surpluspurpose.com/#pricing](https://surpluspurpose.com) |

---

## Impact Methodology

- **CO₂ savings:** GHG Protocol
- **Social resource value:** GIIN IRIS+
- **ESG reporting:** ESRS-aligned (CSRD 2026)

---

## Legal

© 2026 sur.plus UG (haftungsbeschränkt), Inning am Ammersee
sur.plus UG (haftungsbeschränkt) · AG München HRB 315904 · Private repository

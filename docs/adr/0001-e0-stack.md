# ADR 0001: E0 stack scaffold

Date: 2026-06-24

## Status

Accepted for E0.

## Context

The existing dashboard is a frontend-only prototype and remains the behavioral
reference. The production rebuild needs a typed, testable workspace before the
data model and repository seam are implemented in E1.

## Decision

Use a pnpm monorepo with:

- `apps/web`: Next.js App Router, TypeScript, Tailwind.
- `packages/domain`: shared domain constants and invariant tests.
- `tools`: ported prototype guard checks wired into CI.

The live Netlify landing page remains deployed from `05_Landingpage/Online`.
Platform entitlements start with Seed and Tree only; Pulse remains a
landing-page assessment flow and not a dashboard plan. Seed must show a clear
upgrade path to Tree when match allowance becomes the limiting factor.

## Consequences

E0 creates the build and review surface only. Supabase migrations, repository
interfaces, RLS tests, and schema-backed behavior remain E1/E2 work.

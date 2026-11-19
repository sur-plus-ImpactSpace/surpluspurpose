# ADR 0006: Security baseline for the production MVP

Date: 2026-06-25

## Status

Accepted for E4 hardening.

## Context

sur.plus handles commercially sensitive surplus data, NGO contact data, audit
evidence, document signatures and AI-assisted workflows. The production MVP
therefore needs security controls from the first backend slice, not after
launch. The baseline is aligned with:

- OWASP ASVS 5.0 for application-security verification;
- OWASP API Security Top 10 2023 for API-specific risks;
- NIST CSF 2.0 for governance, protect, detect, respond and recover outcomes;
- NIST SP 800-207 Zero Trust Architecture for per-request authorization.

## Decision

Security is modeled as a code-level contract in
`packages/domain/src/security-controls.ts` and attached to the versioned API
contract in `packages/domain/src/api-contract.ts`.

The MVP baseline:

1. Resolve `ActorContext` on every request. No network, session or UI trust is
   reused across requests.
2. Enforce object authorization in Supabase RLS and again at repository command
   boundaries for defense in depth.
3. Redact object properties by default: NGO/corporate contact fields are not
   available until the match unlock state.
4. Keep privileged Supabase service-role keys server-only. Browser code receives
   only anon/session-scoped credentials.
5. Require idempotency keys for authenticated mutations.
6. Require provider signatures for DocuSeal webhooks.
7. Rate-limit mutation, webhook and AI endpoints.
8. Audit all security/compliance mutations.
9. Emit browser security headers and CSP from the Next app.
10. Run dependency audit scanning in GitHub, with CodeQL gated until GitHub
    Code Scanning is enabled for the repository.

## Implementation

- `.github/dependabot.yml` keeps npm and GitHub Actions dependencies current.
- `.github/workflows/security.yml` runs a pnpm dependency audit and keeps
  CodeQL ready behind the `CODEQL_ENABLED=true` repository variable.
- `apps/web/proxy.ts` emits per-request nonce CSP for hydrated Next pages.
- `apps/web/next.config.mjs` emits frame, MIME, referrer and permissions
  headers.
- `packages/domain/src/security-controls.ts` defines the control IDs and their
  NIST/OWASP mapping.
- `packages/domain/src/api-contract.ts` requires every endpoint to declare
  rate-limit policy and security controls.
- `packages/domain/src/rate-limit.ts` defines default fixed-window budgets for
  read, mutation, strict and webhook policies; preview routes translate those
  limits into HTTP 429 responses with `Retry-After`.

## Required before production launch

These are human/infra tasks and should not be guessed in code:

- enable Supabase leaked-password protection and MFA for admin users;
- configure Supabase Auth redirect allowlists for production domains only;
- rotate all service-role and webhook secrets before launch;
- configure DocuSeal webhook signing secret and reject unsigned events;
- enable GitHub branch protection requiring CI and Security workflows;
- enable GitHub Code Scanning and set the repository variable
  `CODEQL_ENABLED=true` before making CodeQL a required check;
- configure alert routing for failed webhook verification, RLS denials and
  unusual mutation volume;
- replace preview in-memory rate limiting with a shared edge/runtime store
  before horizontal scaling;
- run an external penetration test before handling real NGO contact data at
  scale;
- write and rehearse a lightweight incident-response runbook.

## Consequences

New endpoints cannot be added safely unless they declare their security
profile. Tests fail if a mutation lacks idempotency/webhook protection, audit or
rate-limit classification. UI work can remain fast, but security-sensitive
behavior must move through repository/API contracts.

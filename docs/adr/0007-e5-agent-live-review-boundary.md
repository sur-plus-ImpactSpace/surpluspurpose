# ADR 0007: E5 agent live review boundary

Date: 2026-06-25

## Status

Accepted for the first E5 slice.

## Context

E5 makes the AI workflow operational enough for the production MVP without
turning it into an autonomous writer, publisher or external actor. The platform
needs low-friction AI help for match review, message drafts, operational
summaries and social-ad drafts, but every customer-visible or external action
must stay inside the approval loop defined in E3.

## Decision

Add a domain-level `agentRuns.create(actor, task)` boundary:

1. Inputs are normalized and bounded before planning.
2. The first implementation uses a deterministic planner, not a live provider.
3. The planner creates an `agent_run` plus `agent_proposed_actions`.
4. Every proposed action is `pending` and `requiresHumanApproval = true`.
5. Execution stays blocked until approval metadata exists.
6. Social-ad tasks create a `documents(kind='social_ad', status='draft')`
   record and a separate pending publish action.
7. Publishing changes the document state only after approval and execution.
8. Every run creation, approval and execution writes audit history.

The future Edge Function or LLM adapter must plug into this same contract. It
may improve findings and drafts, but it must not bypass proposed actions,
approval metadata or audit history.

The E5 API boundary includes shared command parsers for `POST /api/agent-runs`
and `POST /api/agent-actions/:actionId/:operation`, where operation is
`approve`, `reject` or `execute`. Preview routes use the same parsers,
idempotency guard and rate-limit guard that production Edge Functions must keep.
Production persistence should move these boundaries into Supabase Edge
Functions without changing request validation, idempotency semantics or
repository behavior.

## Consequences

- The production app can show a real approval queue before adding provider
  secrets or network calls.
- Prompt injection and attachment parsing risk is contained because agent output
  is data, not execution.
- Social posts are reviewable documents first; external channel posting remains
  a separate approved integration.
- The next slice can replace preview in-memory repositories with persistent
  Supabase mutation handlers while preserving the same HTTP contract.

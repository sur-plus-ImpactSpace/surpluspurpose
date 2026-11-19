# ADR 0004: E3 loop engineering guardrail

Date: 2026-06-24

## Status

Accepted for the first E3 slice.

## Context

The platform needs AI/Copilot help for listing review, match explanation,
document drafting and future social assets. The risk is letting an agent write,
publish, contact external parties, unlock sensitive data or make green/legal
claims without a human in the loop.

## Decision

Model AI work as a loop:

1. `agent_runs` store the task, prompt, findings, summary and owning role/org.
2. `agent_proposed_actions` store each proposed write or external action.
3. Every proposed action has `requires_human_approval = true`.
4. Execution is valid only after approval metadata exists.
5. Repository methods enforce `pending -> approved/rejected -> executed`.
6. RLS keeps runs/actions inside the same org visibility boundary as the rest of
   the workspace.

The app renders this as an approval queue, not as autonomous AI execution.

## Consequences

Future Edge Functions may create `agent_runs` and proposed actions, but they
must not execute them. Execution belongs to an explicit human approval path with
an audit event.

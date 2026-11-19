# ADR 0020: E20 invitation delivery observability

Date: 2026-06-26

## Status

Accepted for MVP operations.

## Context

E17 through E19 made workspace invitations creatable, revocable and resendable
with token rotation. The remaining operational gap is visibility into delivery:
Ops needs to know whether an invitation email was sent, skipped because no
provider is configured, or failed at the provider boundary.

Audit events record that a control happened, but they do not carry provider
metadata such as message id, failure reason or skipped-delivery reason. Storing
raw invite links would be a security regression.

## Decision

Add a small provider-neutral invitation delivery log:

- Persist one delivery attempt for invitation create and invitation resend.
- Store operation, provider, delivery status, optional provider message id,
  error or skipped reason, actor and timestamp.
- Do not store acceptance tokens or acceptance URLs.
- Use a Supabase RPC so actor scope is enforced with the same Corporate, NGO and
  sur.plus Ops rules as invitation mutation.
- Show only the latest delivery attempt inline in the dashboard invitation
  queue to avoid adding a heavy operations table too early.

## Consequences

sur.plus can support invitation setup without searching email provider logs for
every issue. The next deeper step, if needed, is provider webhook reconciliation
for bounces, opens or deferred delivery, but that is deliberately outside the MVP
slice.

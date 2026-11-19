# ADR 0021: E21 workspace member directory

Date: 2026-06-26

## Status

Accepted for MVP operations.

## Context

E17 through E20 made workspace invitations creatable, revocable, resendable and
observable. Once an invite is accepted, the dashboard still needs to show active
members and seat usage. Without that view, Corporate users cannot understand why
Seed seat capacity is exhausted, NGOs cannot see who has access, and sur.plus Ops
has to infer membership from raw records.

Supabase also needs a matching RLS boundary. A user should see members in their
own Corporate or NGO workspace, Ops should see all users, and no workspace should
see members from another organization.

## Decision

Add a small workspace member directory:

- Add a repository `users.list(actor)` boundary scoped to the actor workspace.
- Show active members inside the existing workspace access panel beside
  invitations.
- Show Corporate active plus pending invitations against the plan seat limit.
- Keep NGO access simple with active and pending counts, without pricing or plan
  language.
- Add a Supabase `users_workspace_visible` RLS policy backed by security-definer
  current-user helper functions.

## Consequences

Workspace access is now understandable after invitation acceptance, not only
before it. This also gives Seed-to-Tree upgrade prompts a concrete seat signal
without adding a separate admin-heavy user-management surface.

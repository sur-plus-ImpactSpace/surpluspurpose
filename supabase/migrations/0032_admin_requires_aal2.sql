-- 0032 — Ops accounts require a second factor (REQ-NFR-03, ADR 0006).
--
-- 2FA (TOTP via Supabase MFA) existed but was optional for everyone. An Ops
-- account can verify organisations, set plans, move and cancel matches for the
-- whole platform, so a stolen password alone must not be enough.
--
-- Every admin capability in the schema — RLS policies and security-definer
-- RPCs alike — is decided by current_role_of(). Making it return NULL for an
-- admin whose session is below aal2 closes all of them at once: such a session
-- keeps only what any signed-in user has (its own users row via users_self), so
-- the app can still tell it is an admin and send it to 2FA enrollment.
--
-- Corporate and NGO sessions are unchanged; 2FA stays optional for them.
-- A missing aal claim counts as aal1 (fail closed).

create or replace function current_role_of() returns user_role
  language sql stable
  security definer
  set search_path = public
  as $$
    select case
      when u.role = 'admin' and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then null
      else u.role
    end
    from users u
    where u.id = auth.uid()
  $$;

comment on function current_role_of() is
  'Role of the signed-in user. NULL for an admin session below aal2 (0032, '
  'REQ-NFR-03): Ops rights require a verified second factor.';

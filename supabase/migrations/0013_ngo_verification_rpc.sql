-- 0013 — Ops NGO verification as a Postgres RPC (Block 1 · native registration).
--
-- set_ngo_verification(p_ngo_id, p_action) mirrors the in-memory
-- repository.ngos.setVerification rules exactly. Ops-only. Each action maps to a
-- target verification state; approve stamps verified_at, every other action
-- clears it (a re-review must earn the date again):
--   approve       -> verified      (verified_at = today)
--   request_info  -> pending_info
--   reject        -> rejected
--   start_review  -> review
--
-- Admin guard, state change and audit event happen atomically under a row lock.

create or replace function set_ngo_verification(
  p_ngo_id uuid,
  p_action text
) returns ngos
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  n ngos%rowtype;
  v_target ngo_verification;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  v_target := case p_action
    when 'approve' then 'verified'
    when 'request_info' then 'pending_info'
    when 'reject' then 'rejected'
    when 'start_review' then 'review'
    else null
  end::ngo_verification;

  if v_target is null then
    raise exception 'invalid_action';
  end if;

  select * into n from ngos where id = p_ngo_id for update;
  if not found then
    raise exception 'ngo_not_found';
  end if;

  update ngos
    set verification_state = v_target,
        verified_at = case when v_target = 'verified' then now()::date else null end
    where id = n.id
    returning * into n;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'ngo.' || p_action, n.id::text, 'admin_only');

  return n;
end;
$$;

revoke all on function set_ngo_verification(uuid, text) from public;
grant execute on function set_ngo_verification(uuid, text) to authenticated;

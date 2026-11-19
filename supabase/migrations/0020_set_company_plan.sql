-- 0020 — let Ops move a company between plans.
--
-- 0019 made self-provisioning work, and everyone lands on 'registered'. There
-- was no way out of it: no Stripe, and no RPC — moving a paying customer onto
-- Seed meant Flo writing UPDATE by hand against production. The funnel now
-- ends in a browse-only account that nothing can upgrade, which is the same
-- shape of gap 0019 just closed one step earlier.
--
-- companies.plan is the only record of who pays until Stripe lands, so the
-- write needs to be deliberate, admin-only and audited — not a policy that
-- happens to allow an UPDATE.

create or replace function set_company_plan(
  p_company_id uuid,
  p_plan text
) returns companies
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  c companies%rowtype;
  v_plan plan_tier;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'admin' then
    raise exception 'forbidden';
  end if;

  if p_plan not in ('registered', 'seed', 'tree') then
    raise exception 'invalid_plan';
  end if;
  v_plan := p_plan::plan_tier;

  select * into c from companies where id = p_company_id;
  if c.id is null then
    raise exception 'company_not_found';
  end if;

  -- A downgrade can strand users: seats are enforced per plan, and 'registered'
  -- allows one. Refuse rather than silently leave a company over its limit —
  -- Ops removes members first, deliberately.
  if (select count(*) from users where company_id = p_company_id and role = 'corporate')
     > (select user_seats from plan_entitlements where plan = v_plan) then
    raise exception 'seat_limit_exceeded';
  end if;

  update companies set plan = v_plan where id = p_company_id returning * into c;

  insert into audit_events (actor, action, target)
  values (auth.uid()::text, 'company.plan_set:' || p_plan, p_company_id::text);

  return c;
end;
$$;

comment on function set_company_plan(uuid, text) is
  'Ops-only: move a company between registered/seed/tree. The manual stand-in for billing until Stripe lands — companies.plan is the only record of who pays, so every write is admin-guarded and audited.';

revoke all on function set_company_plan(uuid, text) from public;
revoke all on function set_company_plan(uuid, text) from anon;
grant execute on function set_company_plan(uuid, text) to authenticated;

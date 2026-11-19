-- 0053 — Companies buy plans online (Stripe Checkout).
--
-- The plan changes ONLY when Stripe tells the server a checkout was paid: the
-- webhook route verifies Stripe's signature and then calls this function with
-- the service role. It is idempotent per Stripe event id (stripe delivers at
-- least once) and only ever upgrades, so a late or replayed event cannot
-- downgrade a company. NGOs have no plan and are always free. Manual plan
-- changes by Ops (set_company_plan, 0020) are untouched.

create table if not exists payment_events (
  event_id text primary key,
  company_id uuid references companies (id) on delete set null,
  plan text not null,
  created_at timestamptz not null default now()
);

alter table payment_events enable row level security;
revoke all on payment_events from anon, authenticated;

create or replace function activate_company_plan_from_payment(
  p_company uuid,
  p_plan text,
  p_event_id text
) returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_company companies%rowtype;
  v_inserted int;
  v_rank_current int;
  v_rank_new int;
begin
  if p_plan not in ('seed', 'tree') then
    raise exception 'invalid_plan';
  end if;
  if coalesce(trim(p_event_id), '') = '' then
    raise exception 'invalid_event';
  end if;

  select * into v_company from companies where id = p_company for update;
  if not found then
    raise exception 'company_not_found';
  end if;

  insert into payment_events (event_id, company_id, plan) values (p_event_id, p_company, p_plan)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;  -- already processed
  end if;

  v_rank_current := array_position(array['registered', 'seed', 'tree'], v_company.plan::text);
  v_rank_new := array_position(array['registered', 'seed', 'tree'], p_plan);
  if v_rank_new <= v_rank_current then
    return false;  -- paid for something the company already has or exceeds
  end if;

  update companies
    set plan = p_plan::plan_tier,
        contract_started_at = case when v_company.plan = 'registered' then current_date else contract_started_at end
    where id = p_company;

  insert into audit_events (actor, action, target, visibility)
  values ('stripe', 'company.plan_paid:' || p_plan, p_company::text, 'admin_only');

  return true;
end;
$$;

revoke all on function activate_company_plan_from_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function activate_company_plan_from_payment(uuid, text, text) to service_role;

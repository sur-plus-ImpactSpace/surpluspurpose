-- 0002 — C1: match state machine as a Postgres RPC (ADR 0026).
--
-- transition_match(p_match_id, p_next_state) mirrors the in-memory
-- repository.matches.transition rules exactly:
--   proposed        -> ngo_confirmed   (NGO of the need)
--   ngo_confirmed   -> both_confirmed  (corporate of the listing, quota-checked)
--   both_confirmed  -> in_transit      (admin)
--   in_transit      -> delivered       (admin)
--   delivered       -> completed       (NGO of the need)
--   any non-terminal -> cancelled      (admin only)
--
-- Quota (ADR 0026): a match consumes one unit when it reaches both_confirmed.
-- Window = contract year (12 months rolling from companies.contract_started_at).
-- Cancellation after both_confirmed does NOT refund the unit (committed_at stays).
-- Count + state change happen atomically under a row lock (no TOCTOU).

alter table companies
  add column if not exists contract_started_at date not null default now();

alter table matches
  add column if not exists committed_at timestamptz;

-- Backfill: legacy committed matches consumed quota at creation time.
update matches
  set committed_at = created_at
  where committed_at is null
    and state in ('both_confirmed', 'in_transit', 'delivered', 'completed');

create index if not exists matches_committed_at_idx on matches (committed_at);

create or replace function transition_match(
  p_match_id uuid,
  p_next_state match_state
) returns matches
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  m matches%rowtype;
  v_listing listings%rowtype;
  v_need needs%rowtype;
  v_company companies%rowtype;
  v_allowance int;
  v_period_start date;
  v_used int;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;

  if m.state in ('cancelled', 'completed') then
    raise exception 'terminal_state';
  end if;

  select * into v_listing from listings where id = m.listing_id;
  select * into v_need from needs where id = m.need_id;

  -- Admin cancellation from any non-terminal state. Consumed quota stays
  -- consumed (committed_at untouched) per ADR 0026.
  if p_next_state = 'cancelled' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

    update matches set state = 'cancelled' where id = m.id returning * into m;

    insert into audit_events (actor, action, target, visibility)
    values (auth.uid()::text, 'match.cancelled', m.id::text, 'admin_only');

    return m;
  end if;

  -- State machine: exactly one allowed step per (from, to) pair.
  if m.state = 'proposed' and p_next_state = 'ngo_confirmed' then
    if actor_role <> 'ngo' or v_need.ngo_id is distinct from current_ngo() then
      raise exception 'actor_not_allowed';
    end if;
    update needs set state = 'matched' where id = v_need.id;

  elsif m.state = 'ngo_confirmed' and p_next_state = 'both_confirmed' then
    if actor_role <> 'corporate' or v_listing.company_id is distinct from current_company() then
      raise exception 'actor_not_allowed';
    end if;

    -- Quota check (ADR 0026): committed matches in the current contract year.
    select * into v_company from companies where id = v_listing.company_id;
    select matches_per_year into v_allowance from plan_entitlements where plan = v_company.plan;

    if v_allowance is not null then
      v_period_start := v_company.contract_started_at
        + make_interval(years => greatest(0, (extract(year from age(now(), v_company.contract_started_at)))::int));

      select count(*) into v_used
      from matches cm
      join listings cl on cl.id = cm.listing_id
      where cl.company_id = v_company.id
        and cm.committed_at is not null
        and cm.committed_at >= v_period_start
        and cm.committed_at < v_period_start + interval '1 year';

      if v_used >= v_allowance then
        raise exception 'match_quota_exceeded';
      end if;
    end if;

    update listings set state = 'confirmed' where id = v_listing.id;

  elsif m.state = 'both_confirmed' and p_next_state = 'in_transit' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

  elsif m.state = 'in_transit' and p_next_state = 'delivered' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

  elsif m.state = 'delivered' and p_next_state = 'completed' then
    if actor_role <> 'ngo' or v_need.ngo_id is distinct from current_ngo() then
      raise exception 'actor_not_allowed';
    end if;
    update listings set state = 'completed' where id = v_listing.id;
    update needs set state = 'fulfilled' where id = v_need.id;

  else
    raise exception 'invalid_transition';
  end if;

  update matches
    set state = p_next_state,
        committed_at = coalesce(committed_at, case when p_next_state = 'both_confirmed' then now() end)
    where id = m.id
    returning * into m;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'match.' || p_next_state::text, m.id::text, 'customer_visible');

  return m;
end;
$$;

revoke all on function transition_match(uuid, match_state) from public;
grant execute on function transition_match(uuid, match_state) to authenticated;

-- 0035 — Proposals expire after 14 days (ADR 0028 D5).
--
--   * expire_stale_proposals(): a match still `proposed` 14 days after it was
--     created is marked `expired`, its listing is released (match_pending ->
--     open) and an audit event is written. Quota is untouched: it is only
--     consumed at both_confirmed (ADR 0026). Mirrors repository.matches.expireStale.
--   * pg_cron runs it daily. It is NOT executable by API roles.
--   * transition_match (0012) treats `expired` as terminal, so an expired
--     proposal can no longer be cancelled or revived.
--   * propose_match (0033) may propose the same pair again after an expiry: the
--     unique pair constraint becomes a partial index that ignores expired rows.

alter table matches drop constraint if exists matches_listing_id_need_id_key;
create unique index if not exists matches_open_pair_idx
  on matches (listing_id, need_id)
  where state <> 'expired';

create or replace function expire_stale_proposals(p_now timestamptz default now())
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_ids uuid[];
  v_id uuid;
begin
  select coalesce(array_agg(id), '{}') into v_ids
  from (
    select id from matches
    where state = 'proposed'
      and created_at <= p_now - interval '14 days'
    order by created_at
    for update skip locked
  ) stale;

  foreach v_id in array v_ids loop
    update matches set state = 'expired' where id = v_id;
    update listings set state = 'open'
      where id = (select listing_id from matches where id = v_id)
        and state = 'match_pending';
    insert into audit_events (actor, action, target, visibility)
    values ('system', 'match.expired', v_id::text, 'customer_visible');
  end loop;

  return coalesce(array_length(v_ids, 1), 0);
end;
$$;

revoke all on function expire_stale_proposals(timestamptz) from public, anon, authenticated;

-- transition_match: only the terminal-state check changed.
CREATE OR REPLACE FUNCTION public.transition_match(p_match_id uuid, p_next_state match_state)
 RETURNS matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  if m.state in ('cancelled', 'completed', 'expired') then
    raise exception 'terminal_state';
  end if;

  select * into v_listing from listings where id = m.listing_id;
  select * into v_need from needs where id = m.need_id;

  if p_next_state = 'cancelled' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

    update matches set state = 'cancelled' where id = m.id returning * into m;

    insert into audit_events (actor, action, target, visibility)
    values (auth.uid()::text, 'match.cancelled', m.id::text, 'admin_only');

    return m;
  end if;

  if m.state = 'proposed' and p_next_state = 'ngo_confirmed' then
    if actor_role <> 'ngo' or v_need.ngo_id is distinct from current_ngo() then
      raise exception 'actor_not_allowed';
    end if;
    update needs set state = 'matched' where id = v_need.id;

  elsif m.state = 'ngo_confirmed' and p_next_state = 'both_confirmed' then
    if actor_role <> 'corporate' or v_listing.company_id is distinct from current_company() then
      raise exception 'actor_not_allowed';
    end if;

    -- Clickwrap gate: the corporate must have accepted the current SaaS terms
    -- before committing a match (this is the binding, quota-consuming step).
    if not has_accepted_current_agreement('saas_terms') then
      raise exception 'agreement_required';
    end if;

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
$function$;

revoke all on function transition_match(uuid, match_state) from public;
grant execute on function transition_match(uuid, match_state) to authenticated;

-- propose_match (0033) with the duplicate check ignoring expired rows.
create or replace function propose_match(
  p_listing_id uuid,
  p_need_id uuid
) returns matches
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_listing listings%rowtype;
  v_need needs%rowtype;
  m matches%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if current_role_of() is null then
    raise exception 'actor_not_available';
  end if;
  if current_role_of() <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  -- Lock the listing first so two concurrent proposals cannot both see it open.
  select * into v_listing from listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found';
  end if;
  select * into v_need from needs where id = p_need_id for update;
  if not found then
    raise exception 'need_not_found';
  end if;

  if v_listing.state <> 'open' then
    raise exception 'listing_not_open';
  end if;
  if v_need.state <> 'open' then
    raise exception 'need_not_open';
  end if;
  if exists (select 1 from matches where listing_id = p_listing_id and need_id = p_need_id and state <> 'expired') then
    raise exception 'match_exists';
  end if;

  insert into matches (listing_id, need_id, state)
  values (p_listing_id, p_need_id, 'proposed')
  returning * into m;

  update listings set state = 'match_pending' where id = p_listing_id;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'match.proposed', m.id::text, 'customer_visible');

  return m;
end;
$$;

revoke all on function propose_match(uuid, uuid) from public;
grant execute on function propose_match(uuid, uuid) to authenticated;

-- Daily sweep at 03:15 UTC. Skipped (with a notice) where pg_cron is not
-- available; the function can then be called from any scheduler as postgres.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-proposals';
    perform cron.schedule('expire-stale-proposals', '15 3 * * *', 'select public.expire_stale_proposals()');
  else
    raise notice 'pg_cron unavailable: schedule expire_stale_proposals() externally';
  end if;
end
$cron$;

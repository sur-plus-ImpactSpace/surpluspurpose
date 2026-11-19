-- 0041 — Cancelled vs. failed, and a fair quota refund (ADR 0028 D4, ADR 0026).
--
-- Two different endings, kept apart for honest success statistics:
--   cancelled  the match was withdrawn before shipping (Ops, from proposed,
--              ngo_confirmed or both_confirmed). The quota unit stays consumed
--              (committed_at untouched, ADR 0026) so confirm-and-cancel cannot
--              be gamed.
--   failed     delivery broke down after shipping (in_transit or delivered).
--              Ops decides fault with fail_match(): when the NGO is NOT at
--              fault the company gets its quota unit back
--              (quota_refunded_at), otherwise it stays consumed.
-- Every decision is audited. A failed match lets go of its part of the need
-- (0039), and the quota count skips refunded matches.

alter table matches
  add column if not exists quota_refunded_at timestamptz,
  add column if not exists failed_ngo_at_fault boolean,
  add column if not exists failure_reason text check (char_length(failure_reason) <= 500);

create or replace function fail_match(
  p_match_id uuid,
  p_ngo_at_fault boolean,
  p_reason text default null
) returns matches
  language plpgsql
  security definer
  set search_path = public
as $$
declare
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
  if p_ngo_at_fault is null then
    raise exception 'invalid_fault';
  end if;
  if char_length(coalesce(p_reason, '')) > 500 then
    raise exception 'invalid_reason';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;
  if m.state in ('cancelled', 'completed', 'expired', 'failed') then
    raise exception 'terminal_state';
  end if;
  -- Before shipping the right ending is a cancellation.
  if m.state not in ('in_transit', 'delivered') then
    raise exception 'not_shipped';
  end if;

  update matches
    set state = 'failed',
        failed_ngo_at_fault = p_ngo_at_fault,
        failure_reason = nullif(trim(coalesce(p_reason, '')), ''),
        quota_refunded_at = case when p_ngo_at_fault then null else coalesce(quota_refunded_at, now()) end
    where id = m.id
    returning * into m;

  perform refresh_need_state(m.need_id);

  insert into audit_events (actor, action, target, visibility)
  values
    (auth.uid()::text, 'match.failed', m.id::text, 'customer_visible'),
    (auth.uid()::text,
     case when p_ngo_at_fault then 'match.failure_assessed:ngo_at_fault' else 'match.failure_assessed:quota_refunded' end,
     m.id::text, 'admin_only');

  return m;
end;
$$;

revoke all on function fail_match(uuid, boolean, text) from public;
grant execute on function fail_match(uuid, boolean, text) to authenticated;

-- transition_match (0039): failed is terminal, cancelling needs a match that has
-- not shipped, and refunded matches no longer count against the quota.
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

  if m.state in ('cancelled', 'completed', 'expired', 'failed') then
    raise exception 'terminal_state';
  end if;

  select * into v_listing from listings where id = m.listing_id;
  select * into v_need from needs where id = m.need_id;

  if p_next_state = 'cancelled' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

    -- Cancelling is for a match withdrawn before shipping. Once the goods are
    -- on their way a collapse is a failure (fail_match), which decides the quota.
    if m.state in ('in_transit', 'delivered') then
      raise exception 'already_shipped';
    end if;

    update matches set state = 'cancelled' where id = m.id returning * into m;
    perform refresh_need_state(m.need_id);

    insert into audit_events (actor, action, target, visibility)
    values (auth.uid()::text, 'match.cancelled', m.id::text, 'admin_only');

    return m;
  end if;

  if m.state = 'proposed' and p_next_state = 'ngo_confirmed' then
    if actor_role <> 'ngo' or v_need.ngo_id is distinct from current_ngo() then
      raise exception 'actor_not_allowed';
    end if;
    if not ngo_is_verified(v_need.ngo_id) then
      raise exception 'org_not_verified';
    end if;

  elsif m.state = 'ngo_confirmed' and p_next_state = 'both_confirmed' then
    if actor_role <> 'corporate' or v_listing.company_id is distinct from current_company() then
      raise exception 'actor_not_allowed';
    end if;

    -- Verification gate (ADR 0027): matching is for verified organisations,
    -- whatever the plan.
    if not company_is_verified(v_listing.company_id) then
      raise exception 'org_not_verified';
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
        and cm.quota_refunded_at is null
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

    -- Step-up (ADR 0027 C5): confirming receipt triggers the donation
    -- certificate, so the NGO must have proved control of its email recently.
    if not recent_email_reauth() then
      raise exception 'step_up_required';
    end if;

    update listings set state = 'completed' where id = v_listing.id;

  else
    raise exception 'invalid_transition';
  end if;

  update matches
    set state = p_next_state,
        committed_at = coalesce(committed_at, case when p_next_state = 'both_confirmed' then now() end)
    where id = m.id
    returning * into m;

  -- The need follows its matches: matched once the confirmed parts cover it,
  -- fulfilled once the completed parts do (a part-filled need stays open).
  if p_next_state in ('ngo_confirmed', 'completed') then
    perform refresh_need_state(m.need_id);
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'match.' || p_next_state::text, m.id::text, 'customer_visible');

  return m;
end;
$function$;

revoke all on function transition_match(uuid, match_state) from public;
grant execute on function transition_match(uuid, match_state) to authenticated;

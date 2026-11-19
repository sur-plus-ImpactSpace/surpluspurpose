-- 0039 — Fill one need in parts (ADR 0028 D3).
--
-- Several companies can each cover part of one NGO need. Every part is its own
-- match with its own quantity and its own run through the one state machine
-- (and its own quota unit at both_confirmed, ADR 0026). The need shows what is
-- still open and refuses proposals beyond it.
--
--   * matches.quantity        the part this match covers. Existing matches are
--                             backfilled with the whole need (what they were).
--   * need_open_quantity()    quantity - parts held by live matches; NULL for a
--                             need that names no quantity ("as many as you have").
--                             A part is held from the proposal until the match
--                             ends: cancelled / expired matches release it.
--   * refresh_need_state()    the need is matched once confirmed parts cover it
--                             and fulfilled once completed parts do. It stays
--                             open while part-filled, and goes back to open when
--                             a part is cancelled.
--   * propose_match           takes an optional quantity (default: as much as
--                             the listing gives and the need still wants).
--   * open_needs_directory    also returns quantity_remaining.

alter table matches add column if not exists quantity int check (quantity > 0);

update matches m
  set quantity = coalesce(nullif(n.quantity, 0), l.quantity)
  from needs n, listings l
  where n.id = m.need_id and l.id = m.listing_id and m.quantity is null;

alter table matches alter column quantity set not null;

create or replace function need_open_quantity(p_need uuid) returns int
  language sql stable security definer
  set search_path = public
  as $$
    select case
      when n.quantity is null or n.quantity = 0 then null
      else greatest(0, n.quantity - coalesce((
        select sum(m.quantity)::int from matches m
        where m.need_id = n.id
          and m.state in ('proposed', 'ngo_confirmed', 'both_confirmed', 'in_transit', 'delivered', 'completed')
      ), 0))
    end
    from needs n where n.id = p_need
  $$;

grant execute on function need_open_quantity(uuid) to authenticated;

create or replace function refresh_need_state(p_need uuid) returns void
  language plpgsql security definer
  set search_path = public
as $$
declare
  v_need needs%rowtype;
  v_confirmed int;
  v_completed int;
  v_state need_state;
begin
  select * into v_need from needs where id = p_need for update;
  if not found or v_need.state = 'closed' then
    return;
  end if;

  select coalesce(sum(quantity) filter (
           where state in ('ngo_confirmed', 'both_confirmed', 'in_transit', 'delivered', 'completed')), 0),
         coalesce(sum(quantity) filter (where state = 'completed'), 0)
    into v_confirmed, v_completed
    from matches where need_id = p_need;

  if v_need.quantity is null or v_need.quantity = 0 then
    -- No quantity named: one match covers the whole need, as before.
    v_state := case when v_completed > 0 then 'fulfilled' when v_confirmed > 0 then 'matched' else 'open' end;
  else
    v_state := case
      when v_completed >= v_need.quantity then 'fulfilled'
      when v_confirmed >= v_need.quantity then 'matched'
      else 'open'
    end;
  end if;

  if v_state <> v_need.state then
    update needs set state = v_state where id = p_need;
  end if;
end;
$$;

revoke all on function refresh_need_state(uuid) from public, anon, authenticated;

-- propose_match gains a parameter: drop the old signature so a two-argument
-- call cannot become ambiguous.
drop function if exists propose_match(uuid, uuid);

CREATE OR REPLACE FUNCTION public.propose_match(p_listing_id uuid, p_need_id uuid, p_quantity integer DEFAULT NULL)
 RETURNS matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_listing listings%rowtype;
  v_need needs%rowtype;
  v_open int;
  v_quantity int;
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

  if not company_is_verified(v_listing.company_id) then
    raise exception 'company_not_verified';
  end if;
  if not ngo_is_verified(v_need.ngo_id) then
    raise exception 'ngo_not_verified';
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

  -- One part of the need: by default as much as the listing can give and the
  -- need still wants. A need that names no quantity has no remainder to guard.
  v_open := need_open_quantity(p_need_id);
  if v_open is not null and v_open <= 0 then
    raise exception 'need_fully_covered';
  end if;
  v_quantity := coalesce(p_quantity, least(v_listing.quantity, coalesce(v_open, v_listing.quantity)));
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  if v_quantity > v_listing.quantity then
    raise exception 'quantity_exceeds_listing';
  end if;
  if v_open is not null and v_quantity > v_open then
    raise exception 'quantity_exceeds_open';
  end if;

  insert into matches (listing_id, need_id, state, quantity)
  values (p_listing_id, p_need_id, 'proposed', v_quantity)
  returning * into m;

  update listings set state = 'match_pending' where id = p_listing_id;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'match.proposed', m.id::text, 'customer_visible');

  return m;
end;
$function$;

revoke all on function propose_match(uuid, uuid, int) from public;
grant execute on function propose_match(uuid, uuid, int) to authenticated;

-- transition_match (0038): the need now follows its matches.
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

-- The browsable directory shows how much of each need is still open.
drop function if exists open_needs_directory();

create function open_needs_directory()
  returns table (
    need_id uuid,
    title text,
    category text,
    quantity int,
    quantity_open boolean,
    urgency need_urgency,
    country text,
    ngo_focus text,
    ngo_country text,
    quantity_remaining int
  )
  language sql stable security definer
  set search_path = public
  as $$
    select
      n.id,
      n.title,
      n.category,
      n.quantity,
      n.quantity_open,
      n.urgency,
      n.country,
      g.focus,
      g.country,
      need_open_quantity(n.id)
    from needs n
    join ngos g on g.id = n.ngo_id
    where n.state = 'open'
      and g.verification_state = 'verified'
      and current_role_of() in ('corporate', 'admin')
    order by n.created_at desc
  $$;

comment on function open_needs_directory() is
  'Open needs plus the posting NGO focus/country and how much of the need is still open. Never returns contact_email, contact_phone, board_contact or address — those stay behind ngos_corporate_after_match and a paid plan.';

revoke all on function open_needs_directory() from public;
revoke all on function open_needs_directory() from anon;
grant execute on function open_needs_directory() to authenticated;

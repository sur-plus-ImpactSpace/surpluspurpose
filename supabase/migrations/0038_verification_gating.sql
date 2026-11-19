-- 0038 — Real features depend on verification, not on the plan (ADR 0027).
--
-- A signup is an application, not access. Until Ops has verified the
-- organisation it can browse the anonymised directory, but it cannot use the
-- features that need trust, whatever plan it is on:
--   * matching        propose_match needs a verified company AND a verified NGO;
--                     transition_match refuses the NGO's and the company's
--                     confirmation while their own organisation is unverified
--   * contact details ngo_unlocked_for_company (RLS on ngos) also needs a
--                     verified company
--   * documents       documents / donation_certificates are readable by their
--                     owners only while their organisation is verified
-- Ops (admin) is never gated. Verification itself stays reachable: its upload
-- tables and RPCs are separate from the gated ones.
--
-- Backfill: companies that were provisioned by hand and already pay (Seed/Tree)
-- were vetted by Ops when they were set up, so they are marked verified here
-- rather than locked out on deploy. Registered companies go through verification.

update companies
  set verification_state = 'verified',
      verified_at = coalesce(verified_at, current_date)
  where plan <> 'registered' and verification_state <> 'verified';

create or replace function company_is_verified(p_company uuid) returns boolean
  language sql stable security definer
  set search_path = public
  as $$
    select coalesce((select verification_state = 'verified' from companies where id = p_company), false)
  $$;

create or replace function ngo_is_verified(p_ngo uuid) returns boolean
  language sql stable security definer
  set search_path = public
  as $$
    select coalesce((select verification_state = 'verified' from ngos where id = p_ngo), false)
  $$;

-- The caller's own organisation is verified. False for admins and anonymous
-- sessions: policies handle Ops separately.
create or replace function current_org_verified() returns boolean
  language sql stable security definer
  set search_path = public
  as $$
    select case current_role_of()
      when 'corporate' then company_is_verified(current_company())
      when 'ngo' then ngo_is_verified(current_ngo())
      else false
    end
  $$;

grant execute on function company_is_verified(uuid), ngo_is_verified(uuid), current_org_verified()
  to authenticated;

-- Contact details: an unlocked match is no longer enough on its own.
create or replace function ngo_unlocked_for_company(p_ngo uuid, p_company uuid) returns boolean
  language sql stable security definer
  set search_path = public
  as $$
    select p_company is not null and company_is_verified(p_company) and exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where n.ngo_id = p_ngo
        and l.company_id = p_company
        and match_unlocks_contact(m)
    )
  $$;

-- Documents.
drop policy if exists documents_visible on documents;
create policy documents_visible on documents for select
  using (
    current_role_of() = 'admin'
    or (
      current_org_verified()
      and (
        company_id = current_company()
        or ngo_id = current_ngo()
        or (match_id is not null and can_access_match(documents.match_id::text))
      )
    )
  );

drop policy if exists donation_certificates_visible on donation_certificates;
create policy donation_certificates_visible on donation_certificates for select
  using (
    current_role_of() = 'admin'
    or (current_org_verified() and can_access_match(donation_certificates.match_id::text))
  );

-- propose_match (0035) with the verification gate.
CREATE OR REPLACE FUNCTION public.propose_match(p_listing_id uuid, p_need_id uuid)
 RETURNS matches
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  insert into matches (listing_id, need_id, state)
  values (p_listing_id, p_need_id, 'proposed')
  returning * into m;

  update listings set state = 'match_pending' where id = p_listing_id;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'match.proposed', m.id::text, 'customer_visible');

  return m;
end;
$function$;

revoke all on function propose_match(uuid, uuid) from public;
grant execute on function propose_match(uuid, uuid) to authenticated;

-- transition_match (0037) with the verification gate on both confirmations.
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
    if not ngo_is_verified(v_need.ngo_id) then
      raise exception 'org_not_verified';
    end if;
    update needs set state = 'matched' where id = v_need.id;

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

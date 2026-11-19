-- 0012_clickwrap_gating.sql — enforce accepted clickwrap before gated actions.
--
-- 0010 records acceptances; this migration turns them into a real gate. Two
-- irreversible, commercially binding actions now require the current agreement
-- version to be accepted first:
--   * corporate confirms a match (transition ngo_confirmed -> both_confirmed):
--     requires the current 'saas_terms'.
--   * NGO counter-signs a donation certificate (confirm_donation_certificate):
--     requires the current 'ngo_partner_agreement'.
--
-- The required version lives in agreement_requirements (one row per kind), so a
-- version bump is a single UPDATE — no code change and no function rewrite. A
-- kind with no requirement row is treated as "not gated" (fail-open by design),
-- so adding a new clickwrap never silently blocks an existing flow.

create table if not exists agreement_requirements (
  kind text primary key,
  current_version text not null,
  updated_at timestamptz not null default now()
);

-- Seed the versions that the app currently ships (AgreementClickwrap version="2026-07").
insert into agreement_requirements (kind, current_version) values
  ('saas_terms', '2026-07'),
  ('ngo_partner_agreement', '2026-07')
on conflict (kind) do nothing;

-- Readable by the app so the client can mirror the gate in the UI.
alter table agreement_requirements enable row level security;
drop policy if exists agreement_requirements_read on agreement_requirements;
create policy agreement_requirements_read on agreement_requirements for select to authenticated
  using (true);
grant select on agreement_requirements to authenticated;

-- True when the caller (as user or via their org) has accepted the *current*
-- version of p_kind. Fail-open when no requirement is configured for the kind.
create or replace function has_accepted_current_agreement(p_kind text)
  returns boolean
  language plpgsql
  security definer
  set search_path = public
  stable
as $$
declare
  v_required text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select current_version into v_required
  from agreement_requirements
  where kind = p_kind;

  if v_required is null then
    return true;  -- not gated
  end if;

  return exists (
    select 1 from agreement_acceptances a
    where a.kind = p_kind
      and a.version = v_required
      and (
        a.actor_user = auth.uid()
        or a.company_id = current_company()
        or a.ngo_id = current_ngo()
      )
  );
end;
$$;

grant execute on function has_accepted_current_agreement(text) to authenticated;

-- Recreate transition_match (0002) with the clickwrap gate on the corporate
-- confirm step. Everything else is unchanged from 0002.
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
$$;

revoke all on function transition_match(uuid, match_state) from public;
grant execute on function transition_match(uuid, match_state) to authenticated;

-- Recreate confirm_donation_certificate (0008) with the clickwrap gate on the
-- NGO counter-signature. Everything else is unchanged from 0008.
create or replace function confirm_donation_certificate(p_document_id uuid)
  returns documents
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  d documents%rowtype;
  v_ngo_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select * into d from documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found';
  end if;
  if d.kind <> 'certificate' then
    raise exception 'not_a_certificate';
  end if;
  if d.status = 'published' then
    return d;  -- idempotent: already counter-signed
  end if;
  if d.status <> 'in_review' then
    raise exception 'invalid_status';
  end if;

  select n.ngo_id into v_ngo_id
  from matches m
  join needs n on n.id = m.need_id
  where m.id = d.match_id;
  if v_ngo_id is null or v_ngo_id is distinct from current_ngo() then
    raise exception 'actor_not_allowed';
  end if;

  -- Clickwrap gate: the NGO must have accepted the current partner agreement
  -- before counter-signing a Zuwendungsbestätigung.
  if not has_accepted_current_agreement('ngo_partner_agreement') then
    raise exception 'agreement_required';
  end if;

  update documents
    set status = 'published', published_at = now()
    where id = p_document_id
    returning * into d;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'document.certificate_confirmed', d.id::text, 'customer_visible');

  return d;
end;
$$;

grant execute on function confirm_donation_certificate(uuid) to authenticated;

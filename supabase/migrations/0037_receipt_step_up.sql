-- 0037 — Extra confirmation before an NGO confirms receipt (ADR 0027 C5).
--
-- Confirming receipt (delivered -> completed) generates the donation
-- certificate, a tax-relevant document. A stolen session or an unattended
-- browser must not be enough, so the transition now requires a fresh email
-- step-up: the NGO signs in again through an emailed link or code.
--
-- No new tables or email plumbing: Supabase Auth already stamps every session
-- with how it was established. After an email link / OTP sign-in the access
-- token carries amr = [{"method":"otp","timestamp":<unix seconds>}]; a password
-- sign-in carries {"method":"password"}. recent_email_reauth() asks whether the
-- session holds an email proof younger than 10 minutes. The TypeScript twin is
-- hasRecentEmailReauth() in packages/domain (used by the UI to prompt early).

create or replace function recent_email_reauth(p_max_age interval default interval '10 minutes')
  returns boolean
  language sql
  stable
  set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements(
      case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
    ) as entry
    where entry ->> 'method' in ('otp', 'magiclink')
      and (entry ->> 'timestamp') ~ '^[0-9]+$'
      and (entry ->> 'timestamp')::bigint >= extract(epoch from now() - p_max_age)
  )
$$;

grant execute on function recent_email_reauth(interval) to authenticated;

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

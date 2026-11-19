-- 0003 — C2: listing and need creation as Postgres RPCs.
--
-- Mirrors repository.listings.create / repository.needs.create exactly:
-- same actor guards, same validation order, same error reasons, same audit
-- actions. Routes map the raised exception messages 1:1.

create or replace function create_listing(
  p_title text,
  p_category text,
  p_quantity int,
  p_unit_value numeric,
  p_city text,
  p_country text,
  p_condition text,
  p_eligibility_usable boolean,
  p_eligibility_policy_fit boolean,
  p_eligibility_ownership boolean,
  p_subcategory text default null,
  p_unit text default null,
  p_available_until date default null,
  p_pickup_window text default null,
  p_packaging text default null,
  p_weight_kg numeric default null,
  p_category_details text default null,
  p_company_id uuid default null
) returns listings
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_company_id uuid;
  created listings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'corporate' and actor_role <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  v_company_id := case when actor_role = 'corporate' then current_company() else p_company_id end;
  if v_company_id is null or not exists (select 1 from companies where id = v_company_id) then
    raise exception 'company_required';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception 'invalid_title'; end if;
  if coalesce(trim(p_category), '') = '' then raise exception 'invalid_category'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if p_unit_value is null or p_unit_value < 0 then raise exception 'invalid_unit_value'; end if;
  if coalesce(trim(p_city), '') = '' or coalesce(trim(p_country), '') = '' then
    raise exception 'invalid_location';
  end if;
  if coalesce(trim(p_condition), '') = '' then raise exception 'invalid_condition'; end if;
  if not (coalesce(p_eligibility_usable, false)
      and coalesce(p_eligibility_policy_fit, false)
      and coalesce(p_eligibility_ownership, false)) then
    raise exception 'eligibility_not_confirmed';
  end if;

  insert into listings (
    company_id, title, category, subcategory, quantity, unit, unit_value,
    city, country, condition, state, available_until, pickup_window,
    packaging, weight_kg, category_details, eligibility
  ) values (
    v_company_id,
    trim(p_title),
    trim(p_category),
    nullif(trim(coalesce(p_subcategory, '')), ''),
    p_quantity,
    coalesce(nullif(trim(coalesce(p_unit, '')), ''), 'units'),
    p_unit_value,
    trim(p_city),
    trim(p_country),
    trim(p_condition),
    'open',
    p_available_until,
    coalesce(trim(coalesce(p_pickup_window, '')), ''),
    coalesce(trim(coalesce(p_packaging, '')), ''),
    coalesce(p_weight_kg, 0),
    coalesce(trim(coalesce(p_category_details, '')), ''),
    jsonb_build_object(
      'usable', p_eligibility_usable,
      'policyFit', p_eligibility_policy_fit,
      'ownership', p_eligibility_ownership
    )
  ) returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'listing.created', created.id::text, 'customer_visible');

  return created;
end;
$$;

create or replace function create_need(
  p_title text,
  p_category text,
  p_quantity int,
  p_city text,
  p_country text,
  p_target_date date default null,
  p_beneficiaries int default null,
  p_story text default null,
  p_ngo_id uuid default null
) returns needs
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_ngo_id uuid;
  created needs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'ngo' and actor_role <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  v_ngo_id := case when actor_role = 'ngo' then current_ngo() else p_ngo_id end;
  if v_ngo_id is null or not exists (select 1 from ngos where id = v_ngo_id) then
    raise exception 'ngo_required';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception 'invalid_title'; end if;
  if coalesce(trim(p_category), '') = '' then raise exception 'invalid_category'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if coalesce(trim(p_city), '') = '' or coalesce(trim(p_country), '') = '' then
    raise exception 'invalid_location';
  end if;
  if p_beneficiaries is not null and p_beneficiaries < 0 then
    raise exception 'invalid_beneficiaries';
  end if;

  insert into needs (
    ngo_id, title, category, quantity, city, country, target_date,
    beneficiaries, state, story
  ) values (
    v_ngo_id,
    trim(p_title),
    trim(p_category),
    p_quantity,
    trim(p_city),
    trim(p_country),
    p_target_date,
    coalesce(p_beneficiaries, 0),
    'open',
    coalesce(trim(coalesce(p_story, '')), '')
  ) returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'need.created', created.id::text, 'customer_visible');

  return created;
end;
$$;

grant execute on function create_listing(text, text, int, numeric, text, text, text, boolean, boolean, boolean, text, text, date, text, text, numeric, text, uuid) to authenticated;
grant execute on function create_need(text, text, int, text, text, date, int, text, uuid) to authenticated;

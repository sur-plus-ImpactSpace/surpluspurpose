-- 0063 — REQ-AUTH-01: listing create requires a verified company (ADR 0027).
--
-- Founder decision (ADR vs katalog): ADR 0027 wins — registration is an
-- application, not access. Unverified corporates may browse the anonymised
-- directory; listing create, matching, contact and documents wait on
-- verification. Mirrors repository.listings.create company_not_verified.

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
  if actor_role <> 'corporate' and not is_ops() then
    raise exception 'actor_not_allowed';
  end if;

  v_company_id := case when actor_role = 'corporate' then current_company() else p_company_id end;
  if v_company_id is null or not exists (select 1 from companies where id = v_company_id) then
    raise exception 'company_required';
  end if;

  if not company_is_verified(v_company_id) then
    raise exception 'company_not_verified';
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

revoke all on function create_listing(text, text, int, numeric, text, text, text, boolean, boolean, boolean, text, text, date, text, text, numeric, text, uuid) from public;
revoke all on function create_listing(text, text, int, numeric, text, text, text, boolean, boolean, boolean, text, text, date, text, text, numeric, text, uuid) from anon;
grant execute on function create_listing(text, text, int, numeric, text, text, text, boolean, boolean, boolean, text, text, date, text, text, numeric, text, uuid) to authenticated;

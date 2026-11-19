-- 0065 — REQ-CORP-01: donation case + positions (ADR 0033).
-- Parallel to listings; matching stays listing-centric until MATCH-09.

create type donation_position_state as enum (
  'draft',
  'ready',
  'confirmed',
  'allocated',
  'delivered',
  'completed',
  'released'
);

create table donation_cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  step smallint not null default 1 check (step between 1 and 7),
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  city text not null,
  country text not null,
  location_notes text,
  time_window text,
  available_from date,
  available_until date,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table donation_positions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references donation_cases (id) on delete cascade,
  category text not null,
  model text not null,
  quantity int not null check (quantity > 0),
  condition text not null,
  provenance text not null,
  state donation_position_state not null default 'ready',
  created_at timestamptz not null default now()
);

create index donation_cases_company_id_idx on donation_cases (company_id);
create index donation_positions_case_id_idx on donation_positions (case_id);

alter table donation_cases enable row level security;
alter table donation_positions enable row level security;

create policy donation_cases_visible on donation_cases for select
  using (
    is_ops()
    or company_id = current_company()
  );

create policy donation_positions_visible on donation_positions for select
  using (
    is_ops()
    or exists (
      select 1
      from donation_cases c
      where c.id = donation_positions.case_id
        and c.company_id = current_company()
    )
  );

create or replace function create_donation_case(
  p_title text,
  p_contact_name text,
  p_contact_email text,
  p_city text,
  p_country text,
  p_contact_phone text default null,
  p_location_notes text default null,
  p_time_window text default null,
  p_available_from date default null,
  p_available_until date default null,
  p_company_id uuid default null
) returns donation_cases
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_company_id uuid;
  created donation_cases%rowtype;
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
  if coalesce(trim(p_contact_name), '') = '' or coalesce(trim(p_contact_email), '') = '' then
    raise exception 'invalid_contact';
  end if;
  if coalesce(trim(p_city), '') = '' or coalesce(trim(p_country), '') = '' then
    raise exception 'invalid_location';
  end if;

  insert into donation_cases (
    company_id, title, step, contact_name, contact_email, contact_phone,
    city, country, location_notes, time_window, available_from, available_until
  ) values (
    v_company_id,
    trim(p_title),
    1,
    trim(p_contact_name),
    trim(p_contact_email),
    nullif(trim(coalesce(p_contact_phone, '')), ''),
    trim(p_city),
    trim(p_country),
    nullif(trim(coalesce(p_location_notes, '')), ''),
    nullif(trim(coalesce(p_time_window, '')), ''),
    p_available_from,
    p_available_until
  ) returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'donation_case.created', created.id::text, 'customer_visible');

  return created;
end;
$$;

create or replace function add_donation_position(
  p_case_id uuid,
  p_category text,
  p_model text,
  p_quantity int,
  p_condition text,
  p_provenance text
) returns donation_positions
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_case donation_cases%rowtype;
  created donation_positions%rowtype;
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

  select * into v_case from donation_cases where id = p_case_id for update;
  if not found then
    raise exception 'case_not_found';
  end if;
  if actor_role = 'corporate' and v_case.company_id <> current_company() then
    raise exception 'actor_not_allowed';
  end if;
  if not company_is_verified(v_case.company_id) then
    raise exception 'company_not_verified';
  end if;

  if coalesce(trim(p_category), '') = '' then raise exception 'invalid_category'; end if;
  if coalesce(trim(p_model), '') = '' then raise exception 'invalid_model'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if coalesce(trim(p_condition), '') = '' then raise exception 'invalid_condition'; end if;
  if coalesce(trim(p_provenance), '') = '' then raise exception 'invalid_provenance'; end if;

  insert into donation_positions (
    case_id, category, model, quantity, condition, provenance, state
  ) values (
    v_case.id,
    trim(p_category),
    trim(p_model),
    p_quantity,
    trim(p_condition),
    trim(p_provenance),
    'ready'
  ) returning * into created;

  if v_case.step = 1 then
    update donation_cases set step = 2 where id = v_case.id;
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'donation_position.created', created.id::text, 'customer_visible');

  return created;
end;
$$;

create or replace function import_donation_positions(
  p_case_id uuid,
  p_positions jsonb
) returns setof donation_positions
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_case donation_cases%rowtype;
  item jsonb;
  created donation_positions%rowtype;
  inserted int := 0;
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

  select * into v_case from donation_cases where id = p_case_id for update;
  if not found then
    raise exception 'case_not_found';
  end if;
  if actor_role = 'corporate' and v_case.company_id <> current_company() then
    raise exception 'actor_not_allowed';
  end if;
  if not company_is_verified(v_case.company_id) then
    raise exception 'company_not_verified';
  end if;

  if p_positions is null or jsonb_typeof(p_positions) <> 'array' then
    raise exception 'invalid_payload';
  end if;
  if jsonb_array_length(p_positions) = 0 then
    raise exception 'empty_positions';
  end if;
  if jsonb_array_length(p_positions) > 500 then
    raise exception 'too_many_positions';
  end if;

  for item in select * from jsonb_array_elements(p_positions)
  loop
    if coalesce(trim(item->>'category'), '') = '' then raise exception 'invalid_category'; end if;
    if coalesce(trim(item->>'model'), '') = '' then raise exception 'invalid_model'; end if;
    if (item->>'quantity') is null or (item->>'quantity')::int <= 0 then
      raise exception 'invalid_quantity';
    end if;
    if coalesce(trim(item->>'condition'), '') = '' then raise exception 'invalid_condition'; end if;
    if coalesce(trim(item->>'provenance'), '') = '' then raise exception 'invalid_provenance'; end if;

    insert into donation_positions (
      case_id, category, model, quantity, condition, provenance, state
    ) values (
      v_case.id,
      trim(item->>'category'),
      trim(item->>'model'),
      (item->>'quantity')::int,
      trim(item->>'condition'),
      trim(item->>'provenance'),
      'ready'
    ) returning * into created;

    inserted := inserted + 1;
    return next created;
  end loop;

  if v_case.step = 1 then
    update donation_cases set step = 2 where id = v_case.id;
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (
    auth.uid()::text,
    'donation_positions.imported:' || inserted::text,
    v_case.id::text,
    'customer_visible'
  );
end;
$$;

revoke all on function create_donation_case(text, text, text, text, text, text, text, text, date, date, uuid) from public;
revoke all on function create_donation_case(text, text, text, text, text, text, text, text, date, date, uuid) from anon;
grant execute on function create_donation_case(text, text, text, text, text, text, text, text, date, date, uuid) to authenticated;

revoke all on function add_donation_position(uuid, text, text, int, text, text) from public;
revoke all on function add_donation_position(uuid, text, text, int, text, text) from anon;
grant execute on function add_donation_position(uuid, text, text, int, text, text) to authenticated;

revoke all on function import_donation_positions(uuid, jsonb) from public;
revoke all on function import_donation_positions(uuid, jsonb) from anon;
grant execute on function import_donation_positions(uuid, jsonb) to authenticated;

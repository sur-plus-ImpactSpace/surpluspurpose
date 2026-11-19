-- 0066 — REQ-CORP-02: confirmation gate before allocation (ADR 0034).

create or replace function donation_case_is_confirmed(p_case_id uuid)
returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
      from donation_cases c
     where c.id = p_case_id
       and c.confirmed_at is not null
  );
$$;

create or replace function confirm_donation_case(p_case_id uuid)
returns donation_cases
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_case donation_cases%rowtype;
  position_count int;
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

  if v_case.confirmed_at is not null then
    raise exception 'already_confirmed';
  end if;

  select count(*) into position_count from donation_positions where case_id = v_case.id;
  if position_count = 0 then
    raise exception 'nothing_to_confirm';
  end if;

  update donation_positions
     set state = 'confirmed'
   where case_id = v_case.id
     and state = 'ready';

  update donation_cases
     set confirmed_at = now(),
         step = 4
   where id = v_case.id
  returning * into v_case;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'donation_case.confirmed', v_case.id::text, 'customer_visible');

  return v_case;
end;
$$;

-- Reopen confirmation when inventory changes after confirm (ADR 0034).
create or replace function reopen_donation_case_confirmation(p_case_id uuid)
returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_case donation_cases%rowtype;
begin
  select * into v_case from donation_cases where id = p_case_id for update;
  if not found then
    return;
  end if;
  if v_case.confirmed_at is null then
    return;
  end if;

  update donation_positions
     set state = 'ready'
   where case_id = v_case.id
     and state = 'confirmed';

  update donation_cases
     set confirmed_at = null,
         step = 2
   where id = v_case.id;

  insert into audit_events (actor, action, target, visibility)
  values (
    auth.uid()::text,
    'donation_case.confirmation_reopened',
    v_case.id::text,
    'customer_visible'
  );
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

  perform reopen_donation_case_confirmation(v_case.id);

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

  if (select step from donation_cases where id = v_case.id) = 1 then
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

  perform reopen_donation_case_confirmation(v_case.id);

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

  if (select step from donation_cases where id = v_case.id) = 1 then
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

revoke all on function donation_case_is_confirmed(uuid) from public;
revoke all on function donation_case_is_confirmed(uuid) from anon;
grant execute on function donation_case_is_confirmed(uuid) to authenticated;

revoke all on function confirm_donation_case(uuid) from public;
revoke all on function confirm_donation_case(uuid) from anon;
grant execute on function confirm_donation_case(uuid) to authenticated;

-- Internal helper for add/import RPCs only — not a client-facing endpoint.
revoke all on function reopen_donation_case_confirmation(uuid) from public;
revoke all on function reopen_donation_case_confirmation(uuid) from anon;
revoke all on function reopen_donation_case_confirmation(uuid) from authenticated;

revoke all on function add_donation_position(uuid, text, text, int, text, text) from public;
revoke all on function add_donation_position(uuid, text, text, int, text, text) from anon;
grant execute on function add_donation_position(uuid, text, text, int, text, text) to authenticated;

revoke all on function import_donation_positions(uuid, jsonb) from public;
revoke all on function import_donation_positions(uuid, jsonb) from anon;
grant execute on function import_donation_positions(uuid, jsonb) to authenticated;

-- 0070 — REQ-MATCH-09: allocation per position + organisation (ADR 0037).

create type donation_allocation_state as enum ('active', 'released');

create table donation_allocations (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references donation_positions (id) on delete cascade,
  case_id uuid not null references donation_cases (id) on delete cascade,
  ngo_id uuid not null references ngos (id),
  quantity int not null check (quantity > 0),
  state donation_allocation_state not null default 'active',
  release_note text,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (state = 'active' and release_note is null and released_at is null)
    or (state = 'released' and release_note is not null and released_at is not null)
  )
);

create index donation_allocations_case_id_idx on donation_allocations (case_id);
create index donation_allocations_position_id_idx on donation_allocations (position_id);
create index donation_allocations_ngo_id_idx on donation_allocations (ngo_id);
create index donation_allocations_active_position_idx
  on donation_allocations (position_id)
  where state = 'active';

alter table donation_allocations enable row level security;

create policy donation_allocations_visible on donation_allocations for select
  using (
    is_ops()
    or ngo_id = current_ngo()
    or exists (
      select 1
        from donation_cases c
       where c.id = donation_allocations.case_id
         and c.company_id = current_company()
    )
  );

-- Reopen also clears allocated positions so inventory can be re-confirmed (ADR 0034/0037).
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
     and state in ('confirmed', 'allocated');

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

create or replace function create_donation_allocation(
  p_case_id uuid,
  p_position_id uuid,
  p_ngo_id uuid,
  p_quantity int
) returns donation_allocations
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_case donation_cases%rowtype;
  v_position donation_positions%rowtype;
  allocated_sum int;
  created donation_allocations%rowtype;
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
  if not donation_case_is_confirmed(v_case.id) then
    raise exception 'case_not_confirmed';
  end if;

  select * into v_position from donation_positions where id = p_position_id for update;
  if not found or v_position.case_id <> v_case.id then
    raise exception 'position_not_found';
  end if;
  if v_position.state not in ('confirmed', 'allocated') then
    raise exception 'position_not_allocatable';
  end if;

  if p_ngo_id is null or not exists (select 1 from ngos where id = p_ngo_id) then
    raise exception 'ngo_not_found';
  end if;
  if not ngo_is_verified(p_ngo_id) then
    raise exception 'ngo_not_verified';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;

  select coalesce(sum(quantity), 0) into allocated_sum
    from donation_allocations
   where position_id = v_position.id
     and state = 'active';

  if allocated_sum + p_quantity > v_position.quantity then
    raise exception 'quantity_exceeds_available';
  end if;

  insert into donation_allocations (
    position_id, case_id, ngo_id, quantity, state
  ) values (
    v_position.id,
    v_case.id,
    p_ngo_id,
    p_quantity,
    'active'
  ) returning * into created;

  if v_position.state = 'confirmed' then
    update donation_positions set state = 'allocated' where id = v_position.id;
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'donation_allocation.created', created.id::text, 'customer_visible');

  return created;
end;
$$;

create or replace function release_donation_allocation(
  p_allocation_id uuid,
  p_release_note text
) returns donation_allocations
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_allocation donation_allocations%rowtype;
  remaining int;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  select * into v_allocation from donation_allocations where id = p_allocation_id for update;
  if not found then
    raise exception 'allocation_not_found';
  end if;
  if v_allocation.state <> 'active' then
    raise exception 'allocation_not_active';
  end if;

  if not is_ops() and not (actor_role = 'ngo' and v_allocation.ngo_id = current_ngo()) then
    raise exception 'actor_not_allowed';
  end if;

  if coalesce(trim(p_release_note), '') = '' then
    raise exception 'invalid_release_note';
  end if;

  update donation_allocations
     set state = 'released',
         release_note = trim(p_release_note),
         released_at = now()
   where id = v_allocation.id
  returning * into v_allocation;

  select coalesce(sum(quantity), 0) into remaining
    from donation_allocations
   where position_id = v_allocation.position_id
     and state = 'active';

  if remaining = 0 then
    update donation_positions
       set state = 'confirmed'
     where id = v_allocation.position_id
       and state = 'allocated';
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'donation_allocation.released', v_allocation.id::text, 'customer_visible');

  return v_allocation;
end;
$$;

revoke all on function reopen_donation_case_confirmation(uuid) from public;
revoke all on function reopen_donation_case_confirmation(uuid) from anon;
revoke all on function reopen_donation_case_confirmation(uuid) from authenticated;

revoke all on function create_donation_allocation(uuid, uuid, uuid, int) from public;
revoke all on function create_donation_allocation(uuid, uuid, uuid, int) from anon;
grant execute on function create_donation_allocation(uuid, uuid, uuid, int) to authenticated;

revoke all on function release_donation_allocation(uuid, text) from public;
revoke all on function release_donation_allocation(uuid, text) from anon;
grant execute on function release_donation_allocation(uuid, text) to authenticated;

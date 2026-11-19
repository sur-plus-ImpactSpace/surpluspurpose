-- 0073 — REQ-MATCH-09: only Ops allocates (founder decision 2026-11-19, ADR 0037).
--
-- Corporate keeps read access to allocations on its own cases (RLS
-- donation_allocations_visible) but no longer creates them. NGO/Ops release is
-- unchanged.

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
  if not is_ops() then
    raise exception 'actor_not_allowed';
  end if;

  select * into v_case from donation_cases where id = p_case_id for update;
  if not found then
    raise exception 'case_not_found';
  end if;
  if not company_is_verified(v_case.company_id) then
    raise exception 'company_not_verified';
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
    position_id, case_id, ngo_id, quantity, state, position_model, case_title
  ) values (
    v_position.id,
    v_case.id,
    p_ngo_id,
    p_quantity,
    'active',
    v_position.model,
    v_case.title
  ) returning * into created;

  if v_position.state = 'confirmed' then
    update donation_positions set state = 'allocated' where id = v_position.id;
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'donation_allocation.created', created.id::text, 'customer_visible');

  return created;
end;
$$;

revoke all on function create_donation_allocation(uuid, uuid, uuid, int) from public;
revoke all on function create_donation_allocation(uuid, uuid, uuid, int) from anon;
grant execute on function create_donation_allocation(uuid, uuid, uuid, int) to authenticated;

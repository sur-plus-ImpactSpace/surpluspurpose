-- 0067 — REQ-NGO-05 / ADR 0035: full needs profile for Ops allocation.
--
-- Adds delivery preference, max qty per match, target group, delivery address
-- (may differ from registered NGO address), and vehicle flag. create_need also
-- starts persisting urgency / quantity_open (columns existed since 0017).

create type need_delivery_preference as enum ('collect', 'ship', 'either');

alter table needs
  add column if not exists delivery_preference need_delivery_preference not null default 'either',
  add column if not exists max_quantity_per_match int,
  add column if not exists target_group text not null default '',
  add column if not exists delivery_address text not null default '',
  add column if not exists has_vehicle boolean not null default false;

alter table needs
  drop constraint if exists needs_max_quantity_per_match_check;

alter table needs
  add constraint needs_max_quantity_per_match_check
  check (max_quantity_per_match is null or max_quantity_per_match > 0);

comment on column needs.delivery_preference is
  'NGO standing preference: collect / ship / either (REQ-NGO-05). Per-allocation mode is MATCH-10.';
comment on column needs.max_quantity_per_match is
  'Optional cap on quantity for any single match. Null = no per-match cap beyond open remainder.';
comment on column needs.target_group is
  'Who the goods serve — free text Ops uses when allocating without calling back.';
comment on column needs.delivery_address is
  'Street/building for handover; may differ from ngos.address. city/country are the locality.';
comment on column needs.has_vehicle is
  'NGO can collect with its own vehicle when preference is collect/either.';

-- Drop the 0061 signature so PostgREST sees one create_need (no overload drift).
drop function if exists create_need(text, text, int, text, text, date, int, text, text, uuid);

create or replace function create_need(
  p_title text,
  p_category text,
  p_quantity int,
  p_city text,
  p_country text,
  p_target_date date default null,
  p_beneficiaries int default null,
  p_story text default null,
  p_subcategory text default null,
  p_urgency need_urgency default 'flexible',
  p_quantity_open boolean default false,
  p_delivery_preference need_delivery_preference default 'either',
  p_max_quantity_per_match int default null,
  p_target_group text default null,
  p_delivery_address text default null,
  p_has_vehicle boolean default false,
  p_ngo_id uuid default null
) returns needs
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_ngo_id uuid;
  v_state need_state;
  created needs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'ngo' and not is_ops() then
    raise exception 'actor_not_allowed';
  end if;

  v_ngo_id := case when actor_role = 'ngo' then current_ngo() else p_ngo_id end;
  if v_ngo_id is null or not exists (select 1 from ngos where id = v_ngo_id) then
    raise exception 'ngo_required';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception 'invalid_title'; end if;
  if coalesce(trim(p_category), '') = '' then raise exception 'invalid_category'; end if;
  -- Quantity optional (0017): "any amount" / open needs are legitimate.
  if p_quantity is not null and p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if coalesce(trim(p_city), '') = '' or coalesce(trim(p_country), '') = '' then
    raise exception 'invalid_location';
  end if;
  if p_beneficiaries is not null and p_beneficiaries < 0 then
    raise exception 'invalid_beneficiaries';
  end if;
  if p_urgency is null then raise exception 'invalid_urgency'; end if;
  if p_delivery_preference is null then raise exception 'invalid_delivery_preference'; end if;
  if p_max_quantity_per_match is not null and p_max_quantity_per_match <= 0 then
    raise exception 'invalid_max_quantity_per_match';
  end if;
  if coalesce(trim(p_target_group), '') = '' then raise exception 'invalid_target_group'; end if;
  if coalesce(trim(p_delivery_address), '') = '' then raise exception 'invalid_delivery_address'; end if;

  v_state := case when ngo_is_verified(v_ngo_id) then 'open'::need_state else 'draft'::need_state end;

  insert into needs (
    ngo_id, title, category, subcategory, quantity, quantity_open, urgency,
    city, country, target_date, beneficiaries, state, story,
    delivery_preference, max_quantity_per_match, target_group, delivery_address, has_vehicle
  ) values (
    v_ngo_id,
    trim(p_title),
    trim(p_category),
    nullif(trim(coalesce(p_subcategory, '')), ''),
    p_quantity,
    coalesce(p_quantity_open, false),
    p_urgency,
    trim(p_city),
    trim(p_country),
    p_target_date,
    coalesce(p_beneficiaries, 0),
    v_state,
    coalesce(trim(coalesce(p_story, '')), ''),
    p_delivery_preference,
    p_max_quantity_per_match,
    trim(p_target_group),
    trim(p_delivery_address),
    coalesce(p_has_vehicle, false)
  ) returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (
    auth.uid()::text,
    case when v_state = 'draft' then 'need.draft_created' else 'need.created' end,
    created.id::text,
    'customer_visible'
  );

  return created;
end;
$$;

revoke all on function create_need(
  text, text, int, text, text, date, int, text, text,
  need_urgency, boolean, need_delivery_preference, int, text, text, boolean, uuid
) from public;
revoke all on function create_need(
  text, text, int, text, text, date, int, text, text,
  need_urgency, boolean, need_delivery_preference, int, text, text, boolean, uuid
) from anon;
grant execute on function create_need(
  text, text, int, text, text, date, int, text, text,
  need_urgency, boolean, need_delivery_preference, int, text, text, boolean, uuid
) to authenticated;

-- Cap proposals at the need's per-match maximum (ADR 0035).
create or replace function public.propose_match(
  p_listing_id uuid,
  p_need_id uuid,
  p_quantity integer default null
) returns matches
  language plpgsql
  security definer
  set search_path = public
as $function$
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
  if not is_ops() then
    raise exception 'actor_not_allowed';
  end if;

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
  if exists (
    select 1 from matches
    where listing_id = p_listing_id and need_id = p_need_id and state <> 'expired'
  ) then
    raise exception 'match_exists';
  end if;

  v_open := need_open_quantity(p_need_id);
  if v_open is not null and v_open <= 0 then
    raise exception 'need_fully_covered';
  end if;
  v_quantity := coalesce(
    p_quantity,
    least(
      v_listing.quantity,
      coalesce(v_open, v_listing.quantity),
      coalesce(v_need.max_quantity_per_match, v_listing.quantity)
    )
  );
  if v_quantity is null or v_quantity <= 0 then
    raise exception 'invalid_quantity';
  end if;
  if v_quantity > v_listing.quantity then
    raise exception 'quantity_exceeds_listing';
  end if;
  if v_open is not null and v_quantity > v_open then
    raise exception 'quantity_exceeds_open';
  end if;
  if v_need.max_quantity_per_match is not null and v_quantity > v_need.max_quantity_per_match then
    raise exception 'quantity_exceeds_max_per_match';
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

-- Directory: non-contact logistics hints only (no delivery_address / has_vehicle).
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
    quantity_remaining int,
    delivery_preference need_delivery_preference,
    max_quantity_per_match int,
    target_group text
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
      need_open_quantity(n.id),
      n.delivery_preference,
      n.max_quantity_per_match,
      n.target_group
    from needs n
    join ngos g on g.id = n.ngo_id
    where n.state = 'open'
      and g.verification_state = 'verified'
      and current_role_of() in ('corporate', 'admin', 'editor')
    order by n.created_at desc
  $$;

comment on function open_needs_directory() is
  'Open needs plus NGO focus/country, open remainder, and non-contact logistics (preference / max qty / target group). Never returns delivery_address, has_vehicle, or NGO contact fields.';

revoke all on function open_needs_directory() from public;
revoke all on function open_needs_directory() from anon;
grant execute on function open_needs_directory() to authenticated;

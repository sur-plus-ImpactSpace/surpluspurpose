-- 0021 — two founder corrections from walking the live funnel (2026-07-16).
--
-- 1. The needs directory is anonymised after all. 0016 showed a registered
--    corporate the posting NGO's name, mirroring the landing page. Founder
--    call: the ten names on the LP are a curated marketing showcase; inside
--    the product, names are part of what Seed and Tree unlock. So the
--    directory returns the need plus an anonymous descriptor (focus, country)
--    and nothing that identifies the organisation.
--
-- 2. claim_workspace carries the person, not just the org. Registration now
--    asks for the contact's name (priority), role and phone; they live in the
--    signup metadata and the claim writes them where they belong.

-- 1. Anonymised directory ----------------------------------------------------

drop function if exists open_needs_directory();

create or replace function open_needs_directory()
  returns table (
    need_id uuid,
    title text,
    category text,
    quantity int,
    quantity_open boolean,
    urgency need_urgency,
    country text,
    ngo_focus text,
    ngo_country text
  )
  language sql
  stable
  security definer
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
      g.country
    from needs n
    join ngos g on g.id = n.ngo_id
    where n.state = 'open'
      and g.verification_state = 'verified'
      and current_role_of() in ('corporate', 'admin')
    order by n.created_at desc;
  $$;

comment on function open_needs_directory() is
  'Open needs for any authenticated corporate, anonymised: the need plus the posting NGO''s focus and country. Never a name, city or contact — identity unlocks with a paid plan (and a match).';

revoke all on function open_needs_directory() from public;
revoke all on function open_needs_directory() from anon;
grant execute on function open_needs_directory() to authenticated;

-- 2. claim_workspace with the person's profile --------------------------------

create or replace function claim_workspace(p_org_name text)
  returns users
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_role text;
  v_email text;
  v_org_name text;
  v_full_name text;
  v_phone text;
  v_company_id uuid;
  v_ngo_id uuid;
  created users;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from users where id = auth.uid()) then
    raise exception 'user_already_provisioned';
  end if;

  select
    lower(email),
    raw_user_meta_data ->> 'requested_role',
    nullif(trim(coalesce(raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(raw_user_meta_data ->> 'phone', '')), '')
    into v_email, v_role, v_full_name, v_phone
    from auth.users
    where id = auth.uid();

  if v_role not in ('corporate', 'ngo') then
    raise exception 'no_requested_role';
  end if;

  v_org_name := nullif(trim(coalesce(p_org_name, '')), '');
  if v_org_name is null or length(v_org_name) < 2 or length(v_org_name) > 160 then
    raise exception 'invalid_org_name';
  end if;

  if v_role = 'corporate' then
    insert into companies (name, contact_email, owner_name)
    values (v_org_name, v_email, v_full_name)
    returning id into v_company_id;
  else
    insert into ngos (name, contact_email, contact_phone, board_contact)
    values (v_org_name, v_email, v_phone, v_full_name)
    returning id into v_ngo_id;
  end if;

  insert into users (id, email, full_name, role, company_id, ngo_id)
  values (auth.uid(), v_email, v_full_name, v_role::user_role, v_company_id, v_ngo_id)
  returning * into created;

  insert into audit_events (actor, action, target)
  values (auth.uid()::text, 'workspace.claimed', coalesce(v_company_id, v_ngo_id)::text);

  return created;
end;
$$;

revoke all on function claim_workspace(text) from public;
revoke all on function claim_workspace(text) from anon;
grant execute on function claim_workspace(text) to authenticated;

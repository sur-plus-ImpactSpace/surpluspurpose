-- 0059 — REQ-OPS-14: Ops admin vs editor (ADR 0032).
--
-- `admin` keeps platform configuration (plans, CO₂ factors, Ops roster writes).
-- `editor` may do day-to-day Ops (verify orgs, propose/fail/ship matches, risk
-- queue). Both require aal2 via current_role_of(), same as admin since 0032.
--
-- RLS that previously checked current_role_of() = 'admin' becomes is_ops().
-- Admin-only RPCs switch to is_ops_admin(); day-to-day Ops RPCs to is_ops().

-- ---------------------------------------------------------------------------
-- 1. Helpers
-- ---------------------------------------------------------------------------

create or replace function is_ops() returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select current_role_of() in ('admin', 'editor');
  $$;

create or replace function is_ops_admin() returns boolean
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select current_role_of() = 'admin';
  $$;

comment on function is_ops() is
  'True when the signed-in user is Ops (admin or editor) at aal2.';
comment on function is_ops_admin() is
  'True when the signed-in user is Ops admin at aal2 (plans, factors, roster).';

grant execute on function is_ops() to anon, authenticated;
grant execute on function is_ops_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. AAL2 gate for both Ops roles (extends 0032)
-- ---------------------------------------------------------------------------

create or replace function current_role_of() returns user_role
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select case
      when u.role in ('admin', 'editor')
        and coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then null
      else u.role
    end
    from users u
    where u.id = auth.uid()
  $$;

comment on function current_role_of() is
  'Role of the signed-in user. NULL for an Ops (admin|editor) session below '
  'aal2 (0032/0059, REQ-NFR-03 / REQ-OPS-14).';

-- ---------------------------------------------------------------------------
-- 3. Org-binding constraints: editor is Ops-shaped (no company/ngo)
-- ---------------------------------------------------------------------------

alter table users drop constraint if exists role_org_consistent;
alter table users add constraint role_org_consistent check (
  (role = 'corporate' and company_id is not null and ngo_id is null) or
  (role = 'ngo' and ngo_id is not null and company_id is null) or
  (role in ('admin', 'editor') and company_id is null and ngo_id is null)
);

alter table invitations drop constraint if exists invitation_role_org_consistent;
alter table invitations add constraint invitation_role_org_consistent check (
  (role = 'corporate' and company_id is not null and ngo_id is null) or
  (role = 'ngo' and ngo_id is not null and company_id is null) or
  (role in ('admin', 'editor') and company_id is null and ngo_id is null)
);

-- ---------------------------------------------------------------------------
-- 4. Rewrite RLS: admin visibility → is_ops()
-- ---------------------------------------------------------------------------

do $$
declare
  pol record;
  new_qual text;
  new_check text;
  role_list text;
  cmd text;
  sql text;
begin
  for pol in
    select *
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%current_role_of() = ''admin''%'
        or coalesce(with_check, '') like '%current_role_of() = ''admin''%'
      )
  loop
    -- pg_policies stores casts: current_role_of() = 'admin'::user_role.
    -- Replace that form first or is_ops()::user_role is left behind (42846).
    new_qual := replace(pol.qual, 'current_role_of() = ''admin''::user_role', 'is_ops()');
    new_qual := replace(new_qual, 'current_role_of() = ''admin''', 'is_ops()');
    new_check := replace(pol.with_check, 'current_role_of() = ''admin''::user_role', 'is_ops()');
    new_check := replace(new_check, 'current_role_of() = ''admin''', 'is_ops()');
    if new_qual is not distinct from pol.qual
       and new_check is not distinct from pol.with_check then
      continue;
    end if;

    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );

    role_list := array_to_string(
      array(
        select case when r = 'public' then 'public' else quote_ident(r) end
        from unnest(pol.roles) as r
      ),
      ', '
    );
    if role_list is null or role_list = '' then
      role_list := 'public';
    end if;

    cmd := lower(pol.cmd);
    sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      case when pol.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      cmd,
      role_list
    );
    if new_qual is not null then
      sql := sql || format(' using (%s)', new_qual);
    end if;
    if new_check is not null then
      sql := sql || format(' with check (%s)', new_check);
    end if;
    execute sql;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Helper functions that inlined admin checks
-- ---------------------------------------------------------------------------

create or replace function can_access_match(p_match_id text) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where m.id::text = p_match_id
        and (
          is_ops()
          or l.company_id = current_company()
          or n.ngo_id = current_ngo()
        )
    )
  $$;

create or replace function can_access_document(p_document_id text) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from documents d
      where d.id::text = p_document_id
        and (
          is_ops()
          or d.company_id = current_company()
          or d.ngo_id = current_ngo()
          or (d.match_id is not null and can_access_match(d.match_id::text))
        )
    )
  $$;

-- ---------------------------------------------------------------------------
-- 6. RPC bodies: day-to-day Ops → is_ops(); config → is_ops_admin()
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
  src text;
  updated text;
  admin_only text[] := array[
    'set_company_plan',
    'set_co2_factor'
  ];
  skip text[] := array[
    'is_ops',
    'is_ops_admin',
    'current_role_of',
    'create_invitation'
  ];
begin
  for r in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not (p.proname = any (skip))
  loop
    src := pg_get_functiondef(r.oid);
    if src is null then
      continue;
    end if;
    updated := src;

    if r.proname = any (admin_only) then
      updated := replace(updated, 'current_role_of() <> ''admin''::user_role', 'not is_ops_admin()');
      updated := replace(updated, 'current_role_of() <> ''admin''', 'not is_ops_admin()');
      updated := replace(updated, 'actor_role <> ''admin''::user_role', 'not is_ops_admin()');
      updated := replace(updated, 'actor_role <> ''admin''', 'not is_ops_admin()');
      updated := replace(updated, 'actor_role = ''admin''::user_role', 'is_ops_admin()');
      updated := replace(updated, 'actor_role = ''admin''', 'is_ops_admin()');
    else
      -- Visibility / capability checks that treated admin as the Ops gate.
      updated := replace(updated, 'current_role_of() = ''admin''::user_role', 'is_ops()');
      updated := replace(updated, 'current_role_of() = ''admin''', 'is_ops()');
      updated := replace(updated, 'current_role_of() <> ''admin''::user_role', 'not is_ops()');
      updated := replace(updated, 'current_role_of() <> ''admin''', 'not is_ops()');
      updated := replace(updated, 'actor_role <> ''admin''::user_role', 'not is_ops()');
      updated := replace(updated, 'actor_role <> ''admin''', 'not is_ops()');
      -- Keep "admin or corporate" style checks working for editors.
      updated := replace(updated, 'actor_role = ''admin''::user_role', 'is_ops()');
      updated := replace(updated, 'actor_role = ''admin''', 'is_ops()');
    end if;

    if updated is distinct from src then
      execute updated;
    end if;
  end loop;
end $$;

-- create_invitation still rejects p_role = 'admin'; also reject editor invites
-- from non-admins. Editor may invite corporate/ngo like admin can.
create or replace function create_invitation(
  p_email text,
  p_role user_role,
  p_company_id uuid default null,
  p_ngo_id uuid default null,
  p_org_name text default null,
  p_expires_at date default null,
  p_acceptance_token_hash text default null
) returns invitations
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  normalized_email text;
  resolved_company uuid;
  resolved_ngo uuid;
  company_plan plan_tier;
  seat_limit int;
  seats_in_use int;
  normalized_token_hash text;
  created invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  normalized_email := lower(trim(p_email));
  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'invalid_invitation';
  end if;

  normalized_token_hash := nullif(lower(trim(coalesce(p_acceptance_token_hash, ''))), '');
  if normalized_token_hash is not null and normalized_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_invitation';
  end if;

  -- Ops roster invites are admin-only (and still go through bootstrap/API, not
  -- this path for admin today). Refuse editor/admin role invites here.
  if p_role in ('admin', 'editor') then
    raise exception 'invalid_invitation';
  end if;

  if not is_ops() and actor_role <> p_role then
    raise exception 'actor_not_allowed';
  end if;

  if p_role = 'corporate' then
    resolved_company := coalesce(p_company_id, current_company());
    if resolved_company is null or p_ngo_id is not null then
      raise exception 'invalid_scope';
    end if;
    if not is_ops() and resolved_company <> current_company() then
      raise exception 'actor_not_allowed';
    end if;

    select plan into company_plan from companies where id = resolved_company;
    if company_plan is null then
      raise exception 'company_not_found';
    end if;

    select user_seats into seat_limit from plan_entitlements where plan = company_plan;
    select count(*) into seats_in_use
      from users
      where role = 'corporate' and company_id = resolved_company;
    select seats_in_use + count(*) into seats_in_use
      from invitations
      where status = 'pending' and role = 'corporate' and company_id = resolved_company;

    if seats_in_use >= seat_limit then
      raise exception 'seat_limit_exceeded';
    end if;

    if exists (
      select 1
      from invitations
      where status = 'pending'
        and role = 'corporate'
        and company_id = resolved_company
        and email = normalized_email
    ) then
      raise exception 'pending_invitation_exists';
    end if;

    insert into invitations (email, role, company_id, ngo_id, org_name, expires_at, acceptance_token_hash)
    values (normalized_email, p_role, resolved_company, null, nullif(trim(p_org_name), ''), p_expires_at, normalized_token_hash)
    returning * into created;

    insert into audit_events (actor, action, target, visibility)
    values (auth.uid()::text, 'invitation.created', created.id::text, 'admin_only');

    return created;
  end if;

  resolved_ngo := coalesce(p_ngo_id, current_ngo());
  if resolved_ngo is null or p_company_id is not null then
    raise exception 'invalid_scope';
  end if;
  if not is_ops() and resolved_ngo <> current_ngo() then
    raise exception 'actor_not_allowed';
  end if;
  if not exists (select 1 from ngos where id = resolved_ngo) then
    raise exception 'ngo_not_found';
  end if;

  if exists (
    select 1
    from invitations
    where status = 'pending'
      and role = 'ngo'
      and ngo_id = resolved_ngo
      and email = normalized_email
  ) then
    raise exception 'pending_invitation_exists';
  end if;

  insert into invitations (email, role, company_id, ngo_id, org_name, expires_at, acceptance_token_hash)
  values (normalized_email, p_role, null, resolved_ngo, nullif(trim(p_org_name), ''), p_expires_at, normalized_token_hash)
  returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'invitation.created', created.id::text, 'admin_only');

  return created;
end;
$$;

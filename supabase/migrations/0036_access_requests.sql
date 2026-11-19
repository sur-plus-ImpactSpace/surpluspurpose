-- 0036 — "Request access" lead capture (REQ-AUTH-05).
--
-- Visitors without an invite leave their details; Ops reads them in the cockpit.
-- The table is closed to the API: the only way in is submit_access_request (the
-- public form), the only way out is the admin-only select policy. One row per
-- email — a repeat submission refreshes the details instead of piling up, and
-- never reveals whether the address was already on the list.

create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  organization text not null check (char_length(organization) between 1 and 200),
  role text not null check (role in ('corporate', 'ngo')),
  email text not null check (char_length(email) between 3 and 254),
  phone text check (char_length(phone) <= 50),
  message text check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);

create unique index if not exists access_requests_email_idx on access_requests (lower(email));
create index if not exists access_requests_created_idx on access_requests (created_at desc);

alter table access_requests enable row level security;
revoke all on access_requests from anon, authenticated;
grant select on access_requests to authenticated;

drop policy if exists access_requests_admin_read on access_requests;
create policy access_requests_admin_read on access_requests for select to authenticated
  using (current_role_of() = 'admin');

create or replace function submit_access_request(
  p_name text,
  p_organization text,
  p_role text,
  p_email text,
  p_phone text default null,
  p_message text default null
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
  v_inserted boolean;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 200 then
    raise exception 'invalid_name';
  end if;
  if char_length(trim(coalesce(p_organization, ''))) not between 1 and 200 then
    raise exception 'invalid_organization';
  end if;
  if p_role is null or p_role not in ('corporate', 'ngo') then
    raise exception 'invalid_role';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  if char_length(coalesce(p_phone, '')) > 50 then
    raise exception 'invalid_phone';
  end if;
  if char_length(coalesce(p_message, '')) > 2000 then
    raise exception 'invalid_message';
  end if;

  insert into access_requests (name, organization, role, email, phone, message)
  values (
    trim(p_name),
    trim(p_organization),
    p_role,
    v_email,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_message, '')), '')
  )
  on conflict (lower(email)) do update
    set name = excluded.name,
        organization = excluded.organization,
        role = excluded.role,
        phone = excluded.phone,
        message = excluded.message
  returning id, (xmax = 0) into v_id, v_inserted;

  -- Audit new leads only, so repeating the form cannot flood the trail.
  if v_inserted then
    insert into audit_events (actor, action, target, visibility)
    values ('anonymous', 'accessRequest.submitted', v_id::text, 'admin_only');
  end if;
end;
$$;

revoke all on function submit_access_request(text, text, text, text, text, text) from public;
grant execute on function submit_access_request(text, text, text, text, text, text) to anon, authenticated;

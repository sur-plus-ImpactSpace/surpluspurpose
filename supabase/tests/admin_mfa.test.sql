-- pgTAP tests for 0032 — Ops rights require aal2 (REQ-NFR-03).
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

create or replace function tests_authenticate_aal(p_user uuid, p_aal text) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    case
      when p_aal is null then json_build_object('sub', p_user, 'role', 'authenticated')
      else json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)
    end::text,
    true
  );
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a201', 'ops-mfa@test.dev'),
  ('00000000-0000-0000-0000-00000000a202', 'corp-mfa@test.dev');

insert into companies (id, name) values
  ('00000000-0000-0000-0000-0000000000a2', 'MFA GmbH');

insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000a201', 'ops-mfa@test.dev', 'admin', null),
  ('00000000-0000-0000-0000-00000000a202', 'corp-mfa@test.dev', 'corporate',
   '00000000-0000-0000-0000-0000000000a2');

-- 1. Admin below aal2 has no admin rights -------------------------------------

select tests_authenticate_aal('00000000-0000-0000-0000-00000000a201', 'aal1');

select is(current_role_of(), null, 'an admin at aal1 has no role');

select throws_ok(
  $$ select set_company_plan('00000000-0000-0000-0000-0000000000a2', 'seed') $$,
  'actor_not_available',
  'an admin at aal1 cannot use an Ops RPC'
);

-- Read checks run as the API role so RLS applies. Hosted Supabase grants table
-- access to `authenticated` by default; mirror that here (rolled back).
grant select on users, companies to authenticated;
set local role authenticated;

select is(
  (select count(*)::int from users where id = '00000000-0000-0000-0000-00000000a201'),
  1,
  'but still reads its own users row, so the app can route it to 2FA enrollment'
);

select is(
  (select count(*)::int from companies),
  0,
  'and sees no other organisation'
);

reset role;

select tests_authenticate_aal('00000000-0000-0000-0000-00000000a201', null);
select is(current_role_of(), null, 'a session without an aal claim counts as aal1');

-- 2. Admin at aal2 is a full admin --------------------------------------------

select tests_authenticate_aal('00000000-0000-0000-0000-00000000a201', 'aal2');

select is(current_role_of(), 'admin'::user_role, 'an admin at aal2 is admin');

select lives_ok(
  $$ select set_company_plan('00000000-0000-0000-0000-0000000000a2', 'seed') $$,
  'and can use Ops RPCs'
);

-- 3. 2FA stays optional for corporates and NGOs -------------------------------

select tests_authenticate_aal('00000000-0000-0000-0000-00000000a202', 'aal1');
select is(current_role_of(), 'corporate'::user_role, 'a corporate at aal1 keeps its role');

select * from finish();

rollback;

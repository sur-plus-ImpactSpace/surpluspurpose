-- pgTAP tests for the "request access" lead capture (REQ-AUTH-05). Rolls back.
begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'seed');
insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null);

create or replace function tests_authenticate(p_user uuid, p_aal text default 'aal2') returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

-- A visitor submits (anon role, no session at all).
select set_config('request.jwt.claims', '', true);
set local role anon;
select lives_ok(
  $$ select submit_access_request('Ada Lovelace', 'Analytical GmbH', 'corporate', ' Ada@Analytical.TEST ', '+49 1', 'Hello') $$,
  'an anonymous visitor can request access'
);
select throws_ok(
  $$ select count(*) from access_requests $$,
  '42501', null, 'an anonymous visitor cannot read the list back'
);
reset role;
select is(
  (select email from access_requests), 'ada@analytical.test', 'the email is stored trimmed and lower-cased'
);

set local role anon;
select lives_ok(
  $$ select submit_access_request('Ada L.', 'Analytical GmbH', 'ngo', 'ADA@analytical.test') $$,
  'a repeat submission is accepted'
);
reset role;
select is((select count(*)::int from access_requests), 1, 'one row per email');
select is((select count(*)::int from audit_events where action = 'accessRequest.submitted'), 1, 'only the first submission is audited');
select is((select name from access_requests), 'Ada L.', 'the repeat refreshes the details');

select throws_ok($$ select submit_access_request('', 'Org', 'ngo', 'a@b.test') $$, 'P0001', 'invalid_name', 'name is required');
select throws_ok($$ select submit_access_request('A', '', 'ngo', 'a@b.test') $$, 'P0001', 'invalid_organization', 'organization is required');
select throws_ok($$ select submit_access_request('A', 'Org', 'admin', 'a@b.test') $$, 'P0001', 'invalid_role', 'only corporate or ngo can ask');
select throws_ok($$ select submit_access_request('A', 'Org', 'ngo', 'not-an-email') $$, 'P0001', 'invalid_email', 'email must look like an email');

-- Only Ops reads the list.
set local role authenticated;
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select is((select count(*)::int from access_requests), 0, 'a corporate sees no access requests');

select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select is((select count(*)::int from access_requests), 1, 'Ops sees the access request');

select tests_authenticate('00000000-0000-0000-0000-00000000ad01', 'aal1');
select is((select count(*)::int from access_requests), 0, 'Ops below aal2 sees nothing');

reset role;
select * from finish();
rollback;

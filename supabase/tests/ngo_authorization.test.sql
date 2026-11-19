-- pgTAP tests for A1 NGO authorisation data (migration 0008).
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

create or replace function tests_authenticate(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'tree');
insert into ngos (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Kleiderkammer Test e.V.');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null);

-- The NGO maintains its own authorisation data.
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok(
  $$ select update_ngo_authorization('143/456/78901', '2024-05-01', 'Finanzamt München',
       'VR 12345', 'Anna Becker', 'Board member') $$,
  'ngo saves its authorisation data'
);
select is(
  (select registry_number || '|' || authorized_signer
     from ngos where id = '00000000-0000-0000-0000-0000000000e1'),
  'VR 12345|Anna Becker',
  'authorisation fields are persisted on the ngo'
);

-- A corporate has no ngo scope → rejected.
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select update_ngo_authorization('x', null, 'x', 'x', 'x', 'x') $$,
  'actor_not_allowed',
  'a corporate cannot set NGO authorisation data'
);

select * from finish();

rollback;

-- pgTAP tests for add_company_verification_document (ADR 0027 C1, migration 0025).
-- Run locally: supabase test db
-- Everything runs in one transaction and rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

create or replace function tests_authenticate(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end $$;

create or replace function tests_clear_auth() returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed: one company (corporate user) and one NGO user (wrong role).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'corp@test.dev'),
  ('00000000-0000-0000-0000-0000000000a2', 'ngo@test.dev');

insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000b1', 'Muster GmbH', 'registered');

insert into ngos (id, name, verification_state, org_type) values
  ('00000000-0000-0000-0000-0000000000d1', 'Helfer e.V.', 'onboarding', 'verein');

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000b1', null),
  ('00000000-0000-0000-0000-0000000000a2', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000d1');

-- 1) Auth guard
select tests_clear_auth();
select throws_ok(
  $$ select add_company_verification_document('x/f.pdf', 'application/pdf', 1, null) $$,
  'P0001', 'auth_required',
  'unauthenticated upload is rejected'
);

-- 2) A non-corporate (NGO) cannot upload a company document
select tests_authenticate('00000000-0000-0000-0000-0000000000a2');
select throws_ok(
  $$ select add_company_verification_document('00000000-0000-0000-0000-0000000000a2/f.pdf', 'application/pdf', 1, null) $$,
  'P0001', 'actor_not_allowed',
  'an NGO cannot file a company verification document'
);

-- 3) A corporate upload is filed against its company
select tests_authenticate('00000000-0000-0000-0000-0000000000a1');
select is(
  (select company_id from add_company_verification_document(
     '00000000-0000-0000-0000-0000000000a1/hr.pdf', 'application/pdf', 2048, 'Handelsregisterauszug') t),
  '00000000-0000-0000-0000-0000000000b1'::uuid,
  'a corporate upload is filed against the caller''s company'
);

-- 4) The object must sit in the caller's own uid folder
select throws_ok(
  $$ select add_company_verification_document('00000000-0000-0000-0000-0000000000a2/steal.pdf', 'application/pdf', 1, null) $$,
  'P0001', 'path_not_owned',
  'a path outside the caller''s own folder is rejected'
);

select tests_clear_auth();

select * from finish();

rollback;

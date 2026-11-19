-- pgTAP tests for add_ngo_verification_document (REQ-NGO-02, migration 0024).
-- Run locally: supabase test db
-- Everything runs in one transaction and rolls back.
--
-- The RPC is security definer and derives the actor + proof kind from the
-- caller's NGO (never from client input), which we drive via JWT claims.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

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

-- Seed: three NGOs (verein / public_body / no type), one corporate.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'verein@test.dev'),
  ('00000000-0000-0000-0000-0000000000f2', 'public@test.dev'),
  ('00000000-0000-0000-0000-0000000000f3', 'notype@test.dev'),
  ('00000000-0000-0000-0000-0000000000c1', 'corp@test.dev');

insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'seed');

insert into ngos (id, name, verification_state, org_type) values
  ('00000000-0000-0000-0000-0000000000e1', 'Verein e.V.', 'onboarding', 'verein'),
  ('00000000-0000-0000-0000-0000000000e2', 'Stadt Musterstadt', 'onboarding', 'public_body'),
  ('00000000-0000-0000-0000-0000000000e3', 'Ohne Typ', 'onboarding', null);

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-0000000000f1', 'verein@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000f2', 'public@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e2'),
  ('00000000-0000-0000-0000-0000000000f3', 'notype@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e3'),
  ('00000000-0000-0000-0000-0000000000c1', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null);

-- 1) Auth guard
select tests_clear_auth();
select throws_ok(
  $$ select add_ngo_verification_document('x/f.pdf', 'application/pdf', 1, null) $$,
  'P0001', 'auth_required',
  'unauthenticated upload is rejected'
);

-- 2) Corporate cannot upload a verification document
select tests_authenticate('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$ select add_ngo_verification_document('00000000-0000-0000-0000-0000000000c1/f.pdf', 'application/pdf', 1, null) $$,
  'P0001', 'actor_not_allowed',
  'a corporate cannot file an NGO verification document'
);

-- 3) A verein NGO upload is filed as a Freistellungsbescheid proof
select tests_authenticate('00000000-0000-0000-0000-0000000000f1');
select is(
  (select proof_kind::text from add_ngo_verification_document(
     '00000000-0000-0000-0000-0000000000f1/fb.pdf', 'application/pdf', 2048, 'Freistellungsbescheid') t),
  'freistellungsbescheid',
  'a verein upload is filed as a Freistellungsbescheid (kind derived from org_type)'
);

-- 4) A public_body upload is filed as a public-law proof
select tests_authenticate('00000000-0000-0000-0000-0000000000f2');
select is(
  (select proof_kind::text from add_ngo_verification_document(
     '00000000-0000-0000-0000-0000000000f2/amt.pdf', 'application/pdf', 2048, null) t),
  'public_law_proof',
  'a public body upload is filed as a public-law proof, not a Freistellungsbescheid'
);

-- 5) The object must sit in the caller's own uid folder
select tests_authenticate('00000000-0000-0000-0000-0000000000f1');
select throws_ok(
  $$ select add_ngo_verification_document('00000000-0000-0000-0000-0000000000f2/steal.pdf', 'application/pdf', 1, null) $$,
  'P0001', 'path_not_owned',
  'a path outside the caller''s own folder is rejected'
);

-- 6) An NGO without an org_type cannot derive a proof kind
select tests_authenticate('00000000-0000-0000-0000-0000000000f3');
select throws_ok(
  $$ select add_ngo_verification_document('00000000-0000-0000-0000-0000000000f3/f.pdf', 'application/pdf', 1, null) $$,
  'P0001', 'org_type_required',
  'an NGO without an org_type is refused (no proof kind can be derived)'
);

select tests_clear_auth();

select * from finish();

rollback;

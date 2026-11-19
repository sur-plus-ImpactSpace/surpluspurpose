-- pgTAP tests for set_ngo_verification (Block 1 · native registration).
-- Run locally: supabase test db
-- Everything runs in one transaction and rolls back.
--
-- set_ngo_verification is security definer and derives the actor exclusively
-- from auth.uid()/users, which we drive via JWT claims.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

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

-- Seed: one applicant NGO (onboarding), one corporate user, one admin user.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');

insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'seed');

insert into ngos (id, name, verification_state, org_type) values
  ('00000000-0000-0000-0000-0000000000e1', 'Applicant e.V.', 'onboarding', 'verein');

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);

-- 1) Auth guard
select tests_clear_auth();
select throws_ok(
  $$ select set_ngo_verification('00000000-0000-0000-0000-0000000000e1', 'approve') $$,
  'P0001', 'auth_required',
  'unauthenticated call is rejected'
);

-- 2) Non-admin guard
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select set_ngo_verification('00000000-0000-0000-0000-0000000000e1', 'approve') $$,
  'P0001', 'actor_not_allowed',
  'corporate cannot verify an NGO'
);

-- 3) Admin: invalid action + unknown NGO
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select set_ngo_verification('00000000-0000-0000-0000-0000000000e1', 'delete') $$,
  'P0001', 'invalid_action',
  'unknown action is rejected'
);
select throws_ok(
  $$ select set_ngo_verification('00000000-0000-0000-0000-000000000999', 'approve') $$,
  'P0001', 'ngo_not_found',
  'unknown NGO id is rejected'
);

-- 4) request_info -> pending_info, verified_at stays null
select is(
  (select verification_state from set_ngo_verification('00000000-0000-0000-0000-0000000000e1', 'request_info') t),
  'pending_info'::ngo_verification,
  'admin sends the application back for more info'
);
select is(
  (select verified_at from ngos where id = '00000000-0000-0000-0000-0000000000e1'),
  null::date,
  'request_info leaves verified_at null'
);

-- 4b) approve is refused while no proof document has been submitted (REQ-NGO-02)
select throws_ok(
  $$ select set_ngo_verification('00000000-0000-0000-0000-0000000000e1', 'approve') $$,
  'P0001', 'verification_document_required',
  'approval is refused until the NGO has submitted a proof document'
);

-- Seed a proof document so approval can proceed (the RPC path is covered in
-- ngo_verification_documents.test.sql).
insert into ngo_verification_documents (ngo_id, proof_kind, storage_path)
values ('00000000-0000-0000-0000-0000000000e1', 'freistellungsbescheid', 'seed/proof.pdf');

-- 5) approve -> verified, verified_at stamped (REQ-NGO-06 notice + period)
select is(
  (select verification_state from set_ngo_verification(
    '00000000-0000-0000-0000-0000000000e1', 'approve', '2024-01-15', 5
  ) t),
  'verified'::ngo_verification,
  'admin approves the application'
);
select isnt(
  (select verified_at from ngos where id = '00000000-0000-0000-0000-0000000000e1'),
  null::date,
  'approve stamps verified_at'
);

-- 6) reject -> rejected, verified_at cleared
select is(
  (select verification_state from set_ngo_verification('00000000-0000-0000-0000-0000000000e1', 'reject') t),
  'rejected'::ngo_verification,
  'admin can reject even a previously verified NGO'
);
select is(
  (select verified_at from ngos where id = '00000000-0000-0000-0000-0000000000e1'),
  null::date,
  'reject clears verified_at'
);

-- 7) Audit trail
select ok(
  (select count(*) >= 3 from audit_events
    where target = '00000000-0000-0000-0000-0000000000e1' and visibility = 'admin_only'),
  'each verification action left an admin_only audit event'
);

select * from finish();

rollback;

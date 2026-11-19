-- pgTAP tests for set_company_verification (ADR 0027 C1, migration 0025).
-- Run locally: supabase test db
-- Everything runs in one transaction and rolls back.

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

-- Seed: one applicant company (onboarding), one corporate user, one admin.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');

insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Applicant GmbH', 'registered', 'onboarding');

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);

-- 1) Auth guard
select tests_clear_auth();
select throws_ok(
  $$ select set_company_verification('00000000-0000-0000-0000-0000000000c1', 'approve') $$,
  'P0001', 'auth_required',
  'unauthenticated call is rejected'
);

-- 2) Non-admin guard
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select set_company_verification('00000000-0000-0000-0000-0000000000c1', 'approve') $$,
  'P0001', 'actor_not_allowed',
  'a corporate cannot verify its own company'
);

-- 3) Admin: invalid action + unknown company
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select set_company_verification('00000000-0000-0000-0000-0000000000c1', 'delete') $$,
  'P0001', 'invalid_action',
  'unknown action is rejected'
);
select throws_ok(
  $$ select set_company_verification('00000000-0000-0000-0000-000000000999', 'approve') $$,
  'P0001', 'company_not_found',
  'unknown company id is rejected'
);

-- 4) request_info -> pending_info, verified_at stays null
select is(
  (select verification_state from set_company_verification('00000000-0000-0000-0000-0000000000c1', 'request_info') t),
  'pending_info'::company_verification,
  'admin sends the application back for more info'
);
select is(
  (select verified_at from companies where id = '00000000-0000-0000-0000-0000000000c1'),
  null::date,
  'request_info leaves verified_at null'
);

-- 4b) approve is refused while no business proof has been submitted
select throws_ok(
  $$ select set_company_verification('00000000-0000-0000-0000-0000000000c1', 'approve') $$,
  'P0001', 'verification_document_required',
  'approval is refused until the company has submitted a business proof'
);

-- Seed a proof document so approval can proceed.
insert into company_verification_documents (company_id, storage_path)
values ('00000000-0000-0000-0000-0000000000c1', 'seed/hr.pdf');

-- 5) approve -> verified, verified_at stamped
select is(
  (select verification_state from set_company_verification('00000000-0000-0000-0000-0000000000c1', 'approve') t),
  'verified'::company_verification,
  'admin approves the application'
);
select isnt(
  (select verified_at from companies where id = '00000000-0000-0000-0000-0000000000c1'),
  null::date,
  'approve stamps verified_at'
);

-- 6) reject -> rejected, verified_at cleared
select is(
  (select verification_state from set_company_verification('00000000-0000-0000-0000-0000000000c1', 'reject') t),
  'rejected'::company_verification,
  'admin can reject even a previously verified company'
);
select is(
  (select verified_at from companies where id = '00000000-0000-0000-0000-0000000000c1'),
  null::date,
  'reject clears verified_at'
);

-- 7) Audit trail
select ok(
  (select count(*) >= 3 from audit_events
    where target = '00000000-0000-0000-0000-0000000000c1' and visibility = 'admin_only'),
  'each verification action left an admin_only audit event'
);

select * from finish();

rollback;

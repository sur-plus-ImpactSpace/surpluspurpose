-- pgTAP · REQ-NGO-06 proof expiry (migration 0068)
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

select has_column('public', 'ngos', 'proof_notice_date', 'proof_notice_date exists');
select has_column('public', 'ngos', 'proof_assessment_period_years', 'assessment period exists');
select has_column('public', 'ngos', 'proof_valid_until', 'derived valid_until exists');
select has_function('public', 'warn_expiring_ngo_proofs', array['timestamptz']);
select has_function('public', 'expire_ngo_proofs', array['timestamptz']);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev'),
  ('00000000-0000-0000-0000-00000000n001', 'ngo@test.dev');

insert into ngos (id, name, verification_state, org_type)
values ('00000000-0000-0000-0000-0000000000e1', 'Proof NGO', 'review', 'verein');

insert into users (id, email, role, ngo_id) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null),
  ('00000000-0000-0000-0000-00000000n001', 'ngo@test.dev', 'ngo', '00000000-0000-0000-0000-0000000000e1');

insert into ngo_verification_documents (ngo_id, proof_kind, storage_path)
values ('00000000-0000-0000-0000-0000000000e1', 'freistellungsbescheid', 'seed/proof.pdf');

select tests_authenticate('00000000-0000-0000-0000-00000000ad01');

select throws_ok(
  $$ select set_ngo_verification('00000000-0000-0000-0000-0000000000e1', 'approve') $$,
  'P0001',
  'proof_validity_required',
  'approve without notice/period is refused for verein'
);

select is(
  (select proof_valid_until from set_ngo_verification(
    '00000000-0000-0000-0000-0000000000e1',
    'approve',
    '2023-01-15',
    5
  ) t),
  '2028-01-15'::date,
  'approve stores derived proof_valid_until'
);

select is(
  warn_expiring_ngo_proofs(timestamptz '2027-12-01 10:00:00+00'),
  1,
  'warn_expiring_ngo_proofs finds the NGO once'
);

select is(
  warn_expiring_ngo_proofs(timestamptz '2027-12-02 10:00:00+00'),
  0,
  'reminder is not sent twice'
);

select is(
  (select count(*)::int from notifications where kind = 'ngo_proof_expiring'),
  2,
  'NGO user and Ops both get the reminder'
);

select is(
  expire_ngo_proofs(timestamptz '2028-01-16 00:00:00+00'),
  1,
  'expire_ngo_proofs suspends the NGO'
);

select is(
  (select verification_state::text from ngos where id = '00000000-0000-0000-0000-0000000000e1'),
  'verification_pending',
  'expired proof demotes to verification_pending'
);

select is(
  (select status from run_scheduled_job('expire_ngo_proofs', timestamptz '2028-01-17 00:00:00+00')),
  'ok',
  'run_scheduled_job knows expire_ngo_proofs'
);

select * from finish();
rollback;

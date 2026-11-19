-- pgTAP tests: real features depend on verification, not on the plan (0038,
-- ADR 0027). Rolls back.
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');

-- A Tree company that is NOT verified, and a verified one for contrast.
insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Unverified Tree GmbH', 'tree', 'onboarding'),
  ('00000000-0000-0000-0000-0000000000c2', 'Verified Tree GmbH', 'tree', 'verified');
insert into ngos (id, name, verification_state) values
  ('00000000-0000-0000-0000-0000000000e1', 'Unverified e.V.', 'verification_pending'),
  ('00000000-0000-0000-0000-0000000000e2', 'Verified e.V.', 'verified');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Unverified offer', 'IT', 5, 'open'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', 'Verified offer', 'IT', 5, 'open'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', 'Confirmed offer', 'IT', 5, 'confirmed');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Unverified need', 'IT', 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e2', 'Verified need', 'IT', 'open');

-- 1) Ops cannot pair unverified organisations ------------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2') $$,
  'P0001', 'company_not_verified', 'an unverified company cannot be proposed, even on Tree'
);
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'ngo_not_verified', 'an unverified NGO cannot be proposed'
);
select lives_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d2') $$,
  'two verified organisations can be proposed'
);

-- 2) Confirmations need the confirming side to be verified ------------------
-- (proposals created directly: they predate a verification being revoked)
insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'proposed'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2', 1, 'ngo_confirmed');
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'ngo_confirmed') $$,
  'P0001', 'org_not_verified', 'an unverified NGO cannot confirm a match'
);
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a3', 'both_confirmed') $$,
  'P0001', 'org_not_verified', 'an unverified company cannot confirm a match, whatever its plan'
);
select is(
  (select state from matches where id = '00000000-0000-0000-0000-0000000000a3'),
  'ngo_confirmed'::match_state,
  'a refused confirmation changes nothing'
);

update ngos set verification_state = 'verified' where id = '00000000-0000-0000-0000-0000000000e1';
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'ngo_confirmed') $$,
  'the same NGO can confirm once verified'
);

-- 3) Contact details and documents ------------------------------------------
-- A both_confirmed match whose company is unverified (e.g. verification revoked).
insert into matches (id, listing_id, need_id, quantity, state, committed_at) values
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d1', 1, 'both_confirmed', now());
insert into documents (id, kind, title, status, company_id, match_id) values
  ('00000000-0000-0000-0000-0000000000f1', 'report', 'CSRD note', 'approved', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a4');

-- Hosted Supabase grants table privileges to authenticated by default and lets
-- RLS decide; the local stack may not, so model the hosted setup (rolled back).
grant select on ngos, documents to authenticated;
set local role authenticated;
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select is(
  (select count(*)::int from ngos where id = '00000000-0000-0000-0000-0000000000e1'),
  0,
  'an unverified company gets no NGO contact row from an unlocked match'
);
select is((select count(*)::int from documents), 0, 'an unverified company reads no documents');

reset role;
update companies set verification_state = 'verified' where id = '00000000-0000-0000-0000-0000000000c1';
set local role authenticated;
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select is(
  (select count(*)::int from ngos where id = '00000000-0000-0000-0000-0000000000e1'),
  1,
  'once verified, the unlocked NGO contact row appears'
);
select is((select count(*)::int from documents), 1, 'once verified, the company reads its documents');

select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select is((select count(*)::int from documents), 1, 'Ops always reads documents');

reset role;
select * from finish();
rollback;

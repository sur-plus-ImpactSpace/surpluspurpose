-- pgTAP tests: cancelled vs. failed, and the fair quota refund (0041, ADR 0028 D4).
-- Rolls back.
begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

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
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev'),
  ('00000000-0000-0000-0000-00000000c001', 'corp1@test.dev'),
  ('00000000-0000-0000-0000-00000000c002', 'corp2@test.dev'),
  ('00000000-0000-0000-0000-00000000c003', 'corp3@test.dev');

-- Three verified companies, each allowed exactly one match this contract year.
update plan_entitlements set matches_per_year = 1 where plan = 'seed';
insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Refund GmbH', 'seed', 'verified'),
  ('00000000-0000-0000-0000-0000000000c2', 'Fault GmbH', 'seed', 'verified'),
  ('00000000-0000-0000-0000-0000000000c3', 'Cancel GmbH', 'seed', 'verified');
insert into ngos (id, name, verification_state) values
  ('00000000-0000-0000-0000-0000000000e1', 'Verified e.V.', 'verified');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null),
  ('00000000-0000-0000-0000-00000000c001', 'corp1@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000c002', 'corp2@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c2', null),
  ('00000000-0000-0000-0000-00000000c003', 'corp3@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c3', null);
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Anything', 'IT', 'open');

-- Per company: listing 1 holds the match under test, listing 2 the one that
-- needs the quota afterwards.
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-0000000000c1', 'R1', 'IT', 5, 'confirmed'),
  ('00000000-0000-0000-0000-000000000b12', '00000000-0000-0000-0000-0000000000c1', 'R2', 'IT', 5, 'match_pending'),
  ('00000000-0000-0000-0000-000000000b21', '00000000-0000-0000-0000-0000000000c2', 'F1', 'IT', 5, 'confirmed'),
  ('00000000-0000-0000-0000-000000000b22', '00000000-0000-0000-0000-0000000000c2', 'F2', 'IT', 5, 'match_pending'),
  ('00000000-0000-0000-0000-000000000b31', '00000000-0000-0000-0000-0000000000c3', 'C1', 'IT', 5, 'confirmed'),
  ('00000000-0000-0000-0000-000000000b32', '00000000-0000-0000-0000-0000000000c3', 'C2', 'IT', 5, 'match_pending');

insert into matches (id, listing_id, need_id, quantity, state, committed_at) values
  ('00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-000000000b11', '00000000-0000-0000-0000-0000000000d1', 5, 'in_transit', now()),
  ('00000000-0000-0000-0000-000000000a12', '00000000-0000-0000-0000-000000000b12', '00000000-0000-0000-0000-0000000000d1', 5, 'ngo_confirmed', null),
  ('00000000-0000-0000-0000-000000000a21', '00000000-0000-0000-0000-000000000b21', '00000000-0000-0000-0000-0000000000d1', 5, 'delivered', now()),
  ('00000000-0000-0000-0000-000000000a22', '00000000-0000-0000-0000-000000000b22', '00000000-0000-0000-0000-0000000000d1', 5, 'ngo_confirmed', null),
  ('00000000-0000-0000-0000-000000000a31', '00000000-0000-0000-0000-000000000b31', '00000000-0000-0000-0000-0000000000d1', 5, 'both_confirmed', now()),
  ('00000000-0000-0000-0000-000000000a32', '00000000-0000-0000-0000-000000000b32', '00000000-0000-0000-0000-0000000000d1', 5, 'ngo_confirmed', null);

-- Each company accepts the SaaS terms so the quota is the only thing in the way.
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select accept_agreement('saas_terms', (select current_version from agreement_requirements where kind = 'saas_terms'));
select tests_authenticate('00000000-0000-0000-0000-00000000c002');
select accept_agreement('saas_terms', (select current_version from agreement_requirements where kind = 'saas_terms'));
select tests_authenticate('00000000-0000-0000-0000-00000000c003');
select accept_agreement('saas_terms', (select current_version from agreement_requirements where kind = 'saas_terms'));

-- 1) Who may fail a match, and when ------------------------------------------
select throws_ok(
  $$ select fail_match('00000000-0000-0000-0000-000000000a11', false) $$,
  'P0001', 'actor_not_allowed', 'a company cannot declare a failure'
);
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select fail_match('00000000-0000-0000-0000-000000000a11', null) $$,
  'P0001', 'invalid_fault', 'the fault decision is mandatory'
);
select throws_ok(
  $$ select fail_match('00000000-0000-0000-0000-000000000a12', false) $$,
  'P0001', 'not_shipped', 'before shipping the ending is a cancellation'
);
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-000000000a11', 'cancelled') $$,
  'P0001', 'already_shipped', 'after shipping a collapse is a failure, not a cancellation'
);

-- 2) Failed, not the NGO's fault: the unit comes back ---------------------------
select is(
  (select state from fail_match('00000000-0000-0000-0000-000000000a11', false, 'carrier lost the pallet') f),
  'failed'::match_state,
  'Ops fails the match without NGO fault'
);
select isnt((select quota_refunded_at from matches where id = '00000000-0000-0000-0000-000000000a11'), null, 'the quota unit is refunded');
select is(
  (select count(*)::int from audit_events where target = '00000000-0000-0000-0000-000000000a11'
     and action in ('match.failed', 'match.failure_assessed:quota_refunded')),
  2,
  'the decision is audited (customer-visible failure + admin-only assessment)'
);
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select lives_ok(
  $$ select transition_match('00000000-0000-0000-0000-000000000a12', 'both_confirmed') $$,
  'the refunded company can commit its next match within the one-match quota'
);

-- 3) Failed through the NGO's fault: the unit stays used -------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select is(
  (select failed_ngo_at_fault from fail_match('00000000-0000-0000-0000-000000000a21', true, 'NGO refused delivery') f),
  true,
  'Ops fails the match with NGO fault'
);
select is((select quota_refunded_at from matches where id = '00000000-0000-0000-0000-000000000a21'), null, 'no refund when the NGO is at fault');
select tests_authenticate('00000000-0000-0000-0000-00000000c002');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-000000000a22', 'both_confirmed') $$,
  'P0001', 'match_quota_exceeded', 'the unit is still used, so the next match is blocked'
);

-- 4) Cancelled before shipping: the unit stays used (ADR 0026) --------------------
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select is(
  (select state from transition_match('00000000-0000-0000-0000-000000000a31', 'cancelled') t),
  'cancelled'::match_state,
  'Ops cancels a confirmed match before shipping'
);
select tests_authenticate('00000000-0000-0000-0000-00000000c003');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-000000000a32', 'both_confirmed') $$,
  'P0001', 'match_quota_exceeded', 'a cancellation does not give the unit back'
);

-- 5) The two endings are terminal and distinct ------------------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select fail_match('00000000-0000-0000-0000-000000000a11', false) $$,
  'P0001', 'terminal_state', 'a failed match cannot fail again'
);
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-000000000a11', 'cancelled') $$,
  'P0001', 'terminal_state', 'a failed match cannot be cancelled'
);

select * from finish();
rollback;

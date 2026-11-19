-- pgTAP tests for transition_match (C1, ADR 0026).
-- Run locally: supabase test db   (requires `supabase init` once; pgTAP ships with the local stack)
-- Everything runs in one transaction and rolls back.
--
-- Note: tests run as the postgres role (RLS bypassed for direct seed/assert
-- statements). transition_match itself is security definer and derives the
-- actor exclusively from auth.uid()/users, which we drive via JWT claims.

begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

-- ---------------------------------------------------------------------------
-- Impersonation helper: transition_match reads auth.uid() from the JWT claims.
-- ---------------------------------------------------------------------------
create or replace function tests_authenticate(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user, 'role', 'authenticated', 'aal', 'aal2',
      -- a session established by an email link a moment ago (step-up, 0037)
      'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint))
    )::text,
    true
  );
end $$;

create or replace function tests_clear_auth() returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;

-- ---------------------------------------------------------------------------
-- Seed: one company (seed plan, contract started 15 Jan), one NGO, three users,
-- listings/needs/matches. a1 walks the happy path, a2 is the permission/quota
-- probe, a3 tests the no-refund rule.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');

insert into companies (id, name, plan, contract_started_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'seed', date '2026-01-15');

insert into ngos (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Kleiderkammer Test e.V.');

-- Matching needs verified organisations (0038).
update companies set verification_state = 'verified';
update ngos set verification_state = 'verified';

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);

insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'ThinkPads', 'IT', 200, 'match_pending'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'Desks', 'Furniture', 48, 'match_pending');

insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Laptops', 'IT', 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'Desks', 'Furniture', 'open');

insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'proposed'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d2', 1, 'proposed');

-- Tight quota so the quota tests are cheap: seed plan = 1 match/contract year.
update plan_entitlements set matches_per_year = 1 where plan = 'seed';

-- ---------------------------------------------------------------------------
-- 1) Auth guard
-- ---------------------------------------------------------------------------
select tests_clear_auth();
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'ngo_confirmed') $$,
  'P0001', 'auth_required',
  'unauthenticated call is rejected'
);

-- ---------------------------------------------------------------------------
-- 2) Role/org guards on the first step
-- ---------------------------------------------------------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000c001'); -- corporate
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'ngo_confirmed') $$,
  'P0001', 'actor_not_allowed',
  'corporate cannot make the NGO confirmation'
);

select tests_authenticate('00000000-0000-0000-0000-00000000e001'); -- ngo
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') $$,
  'P0001', 'invalid_transition',
  'skipping states is rejected'
);
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'cancelled') $$,
  'P0001', 'actor_not_allowed',
  'only admin may cancel'
);
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-000000000999', 'ngo_confirmed') $$,
  'P0001', 'match_not_found',
  'unknown match id'
);

-- ---------------------------------------------------------------------------
-- 3) Happy path: proposed -> ngo_confirmed (NGO)
-- ---------------------------------------------------------------------------
select is(
  (select state from transition_match('00000000-0000-0000-0000-0000000000a1', 'ngo_confirmed') t),
  'ngo_confirmed'::match_state,
  'NGO confirms the fit'
);
select is(
  (select state from needs where id = '00000000-0000-0000-0000-0000000000d1'),
  'matched'::need_state,
  'need side effect applied'
);
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'both_confirmed') $$,
  'P0001', 'actor_not_allowed',
  'NGO cannot make the corporate confirmation'
);

-- ---------------------------------------------------------------------------
-- 4) ngo_confirmed -> both_confirmed (corporate) consumes quota
-- ---------------------------------------------------------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select accept_agreement('saas_terms', (select current_version from agreement_requirements where kind = 'saas_terms'));
select is(
  (select state from transition_match('00000000-0000-0000-0000-0000000000a1', 'both_confirmed') t),
  'both_confirmed'::match_state,
  'corporate confirms the match'
);
select is(
  (select state from listings where id = '00000000-0000-0000-0000-0000000000b1'),
  'confirmed'::listing_state,
  'listing side effect applied'
);
select isnt(
  (select committed_at from matches where id = '00000000-0000-0000-0000-0000000000a1'),
  null::timestamptz,
  'committed_at is stamped when quota is consumed'
);

-- ---------------------------------------------------------------------------
-- 5) Quota exceeded on the second match (allowance = 1)
-- ---------------------------------------------------------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select is(
  (select state from transition_match('00000000-0000-0000-0000-0000000000a2', 'ngo_confirmed') t),
  'ngo_confirmed'::match_state,
  'second match reaches ngo_confirmed (no quota consumed yet)'
);

select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a2', 'both_confirmed') $$,
  'P0001', 'match_quota_exceeded',
  'second commit in the same contract year exceeds the allowance'
);

-- ---------------------------------------------------------------------------
-- 6) Contract-year window: a commit from the PREVIOUS contract year frees the
--    current window. (Move a1 consumption back one year, then restore.)
-- ---------------------------------------------------------------------------
update matches
  set committed_at = committed_at - interval '1 year'
  where id = '00000000-0000-0000-0000-0000000000a1';

select lives_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a2', 'both_confirmed') $$,
  'quota window rolls with the contract year, not the calendar year'
);

update matches
  set committed_at = committed_at + interval '1 year'
  where id = '00000000-0000-0000-0000-0000000000a1';

-- ---------------------------------------------------------------------------
-- 7) Logistics steps are admin-only
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'in_transit') $$,
  'P0001', 'actor_not_allowed',
  'corporate cannot mark pickup'
);

select tests_authenticate('00000000-0000-0000-0000-00000000ad01'); -- admin
select is(
  (select state from transition_match('00000000-0000-0000-0000-0000000000a1', 'in_transit') t),
  'in_transit'::match_state,
  'admin marks pickup'
);
select is(
  (select state from transition_match('00000000-0000-0000-0000-0000000000a1', 'delivered') t),
  'delivered'::match_state,
  'admin marks delivery'
);

-- ---------------------------------------------------------------------------
-- 8) delivered -> completed (NGO) + side effects
-- ---------------------------------------------------------------------------
-- Receipt triggers the donation certificate: it needs a fresh email proof (0037).
create or replace function tests_authenticate_amr(p_user uuid, p_amr jsonb) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2', 'amr', p_amr)::text,
    true
  );
end $$;

select tests_authenticate_amr('00000000-0000-0000-0000-00000000e001', null);
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') $$,
  'P0001', 'step_up_required',
  'receipt is refused for a session with no amr claim'
);
select tests_authenticate_amr('00000000-0000-0000-0000-00000000e001',
  jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint)));
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') $$,
  'P0001', 'step_up_required',
  'a fresh password login is not an email proof'
);
select tests_authenticate_amr('00000000-0000-0000-0000-00000000e001',
  jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', extract(epoch from now() - interval '11 minutes')::bigint)));
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') $$,
  'P0001', 'step_up_required',
  'an email proof older than 10 minutes has expired'
);
select tests_authenticate_amr('00000000-0000-0000-0000-00000000c001',
  jsonb_build_array(jsonb_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint)));
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') $$,
  'P0001', 'actor_not_allowed',
  'the actor check still comes first'
);
select is(
  (select state from matches where id = '00000000-0000-0000-0000-0000000000a1'),
  'delivered'::match_state,
  'a refused receipt changes nothing'
);

select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select is(
  (select state from transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') t),
  'completed'::match_state,
  'NGO confirms receipt after an email step-up'
);
select is(
  (select state from listings where id = '00000000-0000-0000-0000-0000000000b1'),
  'completed'::listing_state,
  'listing completes'
);
select is(
  (select state from needs where id = '00000000-0000-0000-0000-0000000000d1'),
  'fulfilled'::need_state,
  'need is fulfilled'
);

-- ---------------------------------------------------------------------------
-- 9) Terminal states stay terminal
-- ---------------------------------------------------------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'cancelled') $$,
  'P0001', 'terminal_state',
  'completed match cannot be cancelled'
);

-- ---------------------------------------------------------------------------
-- 10) Cancellation does not refund quota (ADR 0026)
-- ---------------------------------------------------------------------------
select is(
  (select state from transition_match('00000000-0000-0000-0000-0000000000a2', 'cancelled') t),
  'cancelled'::match_state,
  'admin cancels the committed match'
);
select isnt(
  (select committed_at from matches where id = '00000000-0000-0000-0000-0000000000a2'),
  null::timestamptz,
  'cancelled match keeps its consumed quota unit'
);

insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', 'Chairs', 'Furniture', 24, 'match_pending');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e1', 'Chairs', 'Furniture', 'open');
insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d3', 1, 'ngo_confirmed');

select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a3', 'both_confirmed') $$,
  'P0001', 'match_quota_exceeded',
  'cancelled-but-committed match still blocks the quota'
);

-- ---------------------------------------------------------------------------
-- 11) Audit trail exists for the walked path
-- ---------------------------------------------------------------------------
select ok(
  (select count(*) >= 5 from audit_events where target = '00000000-0000-0000-0000-0000000000a1'),
  'every transition on a1 left an audit event'
);
select is(
  (select count(*)::int from audit_events
    where target = '00000000-0000-0000-0000-0000000000a2' and action = 'match.cancelled' and visibility = 'admin_only'),
  1,
  'cancellation is audited admin_only'
);

select * from finish();

rollback;

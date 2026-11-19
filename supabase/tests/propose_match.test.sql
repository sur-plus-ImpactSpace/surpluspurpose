-- pgTAP tests for propose_match (ADR 0028 D1). Rolls back.
begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

create or replace function tests_authenticate(p_user uuid, p_aal text default 'aal2') returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text,
    true
  );
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'seed');
insert into ngos (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Kleiderkammer Test e.V.');

-- Matching needs verified organisations (0038).
update companies set verification_state = 'verified';
update ngos set verification_state = 'verified';
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Desks', 'Furniture', 48, 'open'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'Draft', 'IT', 5, 'draft');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Desks', 'Furniture', 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'Done', 'IT', 'fulfilled');

select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'auth_required', 'unauthenticated call is rejected'
);

select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'actor_not_allowed', 'a corporate cannot propose matches'
);

select tests_authenticate('00000000-0000-0000-0000-00000000ad01', 'aal1');
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'actor_not_available', 'an admin below aal2 cannot propose matches'
);

select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'listing_not_found', 'unknown listing'
);
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000f9') $$,
  'P0001', 'need_not_found', 'unknown need'
);
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1') $$,
  'P0001', 'listing_not_open', 'a draft listing cannot be proposed'
);
select throws_ok(
  $$ select propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2') $$,
  'P0001', 'need_not_open', 'a fulfilled need cannot be proposed'
);

select is(
  (select state from propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') p),
  'proposed'::match_state,
  'admin proposes the pair'
);
select is(
  (select state from listings where id = '00000000-0000-0000-0000-0000000000b1'),
  'match_pending'::listing_state,
  'the listing is parked while the proposal is open'
);
select is(
  (select count(*)::int from audit_events where action = 'match.proposed'),
  1,
  'the proposal is audited'
);

select * from finish();
rollback;

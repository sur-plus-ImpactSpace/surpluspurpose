-- pgTAP tests for create_listing / create_need (C2).
-- Run locally: supabase test db
-- Tests run as postgres (RLS bypassed for asserts); actors come from JWT claims.

begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

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

-- Seed
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');

insert into companies (id, name, plan, verification_state, verified_at) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'seed', 'verified', current_date);

insert into ngos (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Kleiderkammer Test e.V.');

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);

-- ---------------------------------------------------------------------------
-- create_listing
-- ---------------------------------------------------------------------------
select tests_clear_auth();
select throws_ok(
  $$ select create_listing('Desks', 'Furniture', 5, 90, 'Munich', 'DE', 'Good', true, true, true) $$,
  'P0001', 'auth_required',
  'listing: unauthenticated rejected'
);

select tests_authenticate('00000000-0000-0000-0000-00000000e001'); -- ngo
select throws_ok(
  $$ select create_listing('Desks', 'Furniture', 5, 90, 'Munich', 'DE', 'Good', true, true, true) $$,
  'P0001', 'actor_not_allowed',
  'listing: NGO cannot create listings'
);

select tests_authenticate('00000000-0000-0000-0000-00000000c001'); -- corporate
update companies
  set verification_state = 'onboarding', verified_at = null
  where id = '00000000-0000-0000-0000-0000000000c1';
select throws_ok(
  $$ select create_listing('Desks', 'Furniture', 5, 90, 'Munich', 'DE', 'Good', true, true, true) $$,
  'P0001', 'company_not_verified',
  'listing: unverified company cannot create'
);
update companies
  set verification_state = 'verified', verified_at = current_date
  where id = '00000000-0000-0000-0000-0000000000c1';
select throws_ok(
  $$ select create_listing('Desks', 'Furniture', 5, 90, 'Munich', 'DE', 'Good', true, false, true) $$,
  'P0001', 'eligibility_not_confirmed',
  'listing: all three eligibility checks required'
);
select throws_ok(
  $$ select create_listing('Desks', 'Furniture', 0, 90, 'Munich', 'DE', 'Good', true, true, true) $$,
  'P0001', 'invalid_quantity',
  'listing: quantity must be positive'
);
select throws_ok(
  $$ select create_listing('  ', 'Furniture', 5, 90, 'Munich', 'DE', 'Good', true, true, true) $$,
  'P0001', 'invalid_title',
  'listing: blank title rejected'
);

select is(
  (select state from create_listing('Standing desks', 'Furniture', 48, 95, 'Munich', 'DE', 'Good', true, true, true) t),
  'open'::listing_state,
  'listing: corporate creates an open listing'
);
select is(
  (select l.unit from listings l where l.title = 'Standing desks'),
  'units',
  'listing: unit defaults to units'
);
select is(
  (select l.eligibility from listings l where l.title = 'Standing desks'),
  '{"usable": true, "policyFit": true, "ownership": true}'::jsonb,
  'listing: eligibility stored with camelCase keys'
);
select is(
  (select count(*)::int from audit_events where action = 'listing.created'),
  1,
  'listing: audit event recorded'
);

-- admin creates for a named company
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select create_listing('Chairs', 'Furniture', 5, 20, 'Munich', 'DE', 'Good', true, true, true) $$,
  'P0001', 'company_required',
  'listing: admin needs an explicit company'
);
select lives_ok(
  $$ select create_listing('Chairs', 'Furniture', 5, 20, 'Munich', 'DE', 'Good', true, true, true,
       null, null, null, null, null, null, null, '00000000-0000-0000-0000-0000000000c1') $$,
  'listing: admin creates for a named company'
);

-- ---------------------------------------------------------------------------
-- create_need
-- ---------------------------------------------------------------------------
select tests_authenticate('00000000-0000-0000-0000-00000000c001'); -- corporate
select throws_ok(
  $$ select create_need(
       'Laptops', 'IT', 20, 'Munich', 'DE', null, null, null, null,
       'flexible', false, 'either', null, 'Students', 'Warehouse 1', false
     ) $$,
  'P0001', 'actor_not_allowed',
  'need: corporate cannot post needs'
);

select tests_authenticate('00000000-0000-0000-0000-00000000e001'); -- ngo
select throws_ok(
  $$ select create_need(
       'Laptops', 'IT', 20, 'Munich', 'DE', null, -1, null, null,
       'flexible', false, 'either', null, 'Students', 'Warehouse 1', false
     ) $$,
  'P0001', 'invalid_beneficiaries',
  'need: negative beneficiaries rejected'
);
select is(
  (select state from create_need(
     'Laptops for classes', 'IT', 20, 'Munich', 'DE', date '2026-11-01', 150,
     '  Warm story.  ', null, 'by_date', false, 'collect', 10,
     'Evening students', 'Jugendzentrum West', true
   ) t),
  'open'::need_state,
  'need: NGO posts an open need'
);
select is(
  (select n.story from needs n where n.title = 'Laptops for classes'),
  'Warm story.',
  'need: story is trimmed'
);
select is(
  (select n.delivery_preference from needs n where n.title = 'Laptops for classes'),
  'collect'::need_delivery_preference,
  'need: delivery preference stored'
);
select is(
  (select count(*)::int from audit_events where action = 'need.created'),
  1,
  'need: audit event recorded'
);

select * from finish();

rollback;

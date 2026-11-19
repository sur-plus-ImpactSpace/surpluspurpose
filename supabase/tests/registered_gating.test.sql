-- pgTAP tests for the 'registered' plan state and ngo_needs_overview.
-- Run locally: supabase test db
-- Everything runs in one transaction and rolls back.
--
-- These assert the landing-page FAQ promise as executable rules:
--   "Initial registration shows you anonymised NGO profiles - category, region
--    and count. Names, contacts and direct matching are unlocked with Seed or
--    Tree. All connections stay on-platform."

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

-- Seed --------------------------------------------------------------------
-- Education/DE gets 3 verified NGOs -> clears k=3, keeps its country.
-- Textiles/DE gets 1 verified NGO   -> below k, must lose the country.
-- Furniture/DE gets 1 verified NGO  -> below k even Europe-wide, must vanish.
-- One unverified NGO in Education/DE must not be counted at all.

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c101', 'registered-corp@test.dev'),
  ('00000000-0000-0000-0000-00000000c102', 'seed-corp@test.dev');

insert into companies (id, name) values
  ('00000000-0000-0000-0000-0000000000d1', 'Unpaid Test GmbH');

insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000d2', 'Paying Test GmbH', 'seed');

insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000c101', 'registered-corp@test.dev', 'corporate',
   '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-00000000c102', 'seed-corp@test.dev', 'corporate',
   '00000000-0000-0000-0000-0000000000d2');

insert into ngos (id, name, country, verification_state, contact_email) values
  ('00000000-0000-0000-0000-0000000000f1', 'Schule Eins e.V.', 'DE', 'verified', 'a@ngo.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'Schule Zwei e.V.', 'DE', 'verified', 'b@ngo.test'),
  ('00000000-0000-0000-0000-0000000000f3', 'Schule Drei e.V.', 'DE', 'verified', 'c@ngo.test'),
  ('00000000-0000-0000-0000-0000000000f4', 'Kleiderkammer e.V.', 'DE', 'verified', 'd@ngo.test'),
  ('00000000-0000-0000-0000-0000000000f5', 'Moebelhilfe e.V.', 'DE', 'verified', 'e@ngo.test'),
  ('00000000-0000-0000-0000-0000000000f6', 'Noch Nicht Geprueft e.V.', 'DE', 'onboarding', 'f@ngo.test');

insert into needs (ngo_id, title, category, country, state) values
  ('00000000-0000-0000-0000-0000000000f1', 'Laptops', 'Education', 'DE', 'open'),
  ('00000000-0000-0000-0000-0000000000f2', 'Laptops', 'Education', 'DE', 'open'),
  ('00000000-0000-0000-0000-0000000000f3', 'Stuehle', 'Education', 'DE', 'open'),
  ('00000000-0000-0000-0000-0000000000f4', 'Jacken', 'Textiles', 'DE', 'open'),
  ('00000000-0000-0000-0000-0000000000f5', 'Tische', 'Furniture', 'DE', 'open'),
  ('00000000-0000-0000-0000-0000000000f6', 'Laptops', 'Education', 'DE', 'open');

-- 1. The unpaid state exists and is the default ---------------------------

select is(
  (select plan::text from companies where id = '00000000-0000-0000-0000-0000000000d1'),
  'registered',
  'a company created without an explicit plan is registered, not seed'
);

select is(
  (select plan::text from companies where id = '00000000-0000-0000-0000-0000000000d2'),
  'seed',
  'an explicit plan is still honoured'
);

select is(
  (select ngo_visibility from plan_entitlements where plan = 'registered'),
  'aggregate',
  'registered only gets aggregate NGO visibility'
);

select is(
  (select matches_per_year from plan_entitlements where plan = 'registered'),
  0,
  'registered cannot match'
);

select is(
  (select count(*)::int from plan_entitlements where plan in ('seed', 'tree') and ngo_visibility <> 'full'),
  0,
  'paid tiers keep full visibility'
);

-- 2. The aggregate honours k-anonymity ------------------------------------

select tests_authenticate('00000000-0000-0000-0000-00000000c101');

select is(
  (select ngo_count from ngo_needs_overview(3) where category = 'Education' and country = 'DE'),
  3,
  'Education/DE has 3 verified NGOs and keeps its country'
);

select ok(
  not exists (select 1 from ngo_needs_overview(3) where category = 'Textiles' and country is not null),
  'a sub-k country bucket never reports a country'
);

select ok(
  not exists (select 1 from ngo_needs_overview(3) where category = 'Furniture'),
  'a category that cannot reach k even Europe-wide is omitted entirely'
);

select ok(
  not exists (select 1 from ngo_needs_overview(3) where ngo_count < 3),
  'no bucket below k is ever returned'
);

-- The unverified NGO also posted an Education/DE need. If it were counted the
-- bucket would be 4, not 3 — the assertion above already pins this, but state
-- it directly so the intent survives a refactor.
select is(
  (select sum(ngo_count)::int from ngo_needs_overview(3)),
  3,
  'unverified NGOs are not counted into the verified network figure'
);

-- 3. Names and contacts stay locked ---------------------------------------

select is(
  (select count(*)::int from ngos),
  0,
  'a registered corporate reads no NGO rows at all — no names, no contacts'
);

select is(
  (select count(*)::int from needs),
  0,
  'a registered corporate reads no need rows — the aggregate is the only surface'
);

select tests_clear_auth();

select * from finish();

rollback;

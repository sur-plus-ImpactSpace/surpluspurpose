-- pgTAP tests for the contact gate (0016).
-- Run locally: supabase test db
-- Everything runs in one transaction and rolls back.
--
-- The rule these encode (founder calls, 2026-07-16): a registered corporate
-- browses needs anonymised — focus and country, never the organisation.
-- Identity, contact and matching are what Seed and Tree unlock. The named
-- needs on the landing page are a curated marketing showcase, not the
-- product surface.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c201', 'unpaid@test.dev');

insert into companies (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Unpaid Test GmbH');

insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000c201', 'unpaid@test.dev', 'corporate',
   '00000000-0000-0000-0000-0000000000e1');

insert into ngos (id, name, city, country, focus, verification_state,
                  contact_email, contact_phone, board_contact, address) values
  ('00000000-0000-0000-0000-0000000000a1', 'Kick ins Leben', 'Leipzig', 'DE', 'Education',
   'verified', 'geheim@kick.test', '+49 111', 'Frau Vorstand', 'Geheimstrasse 1'),
  ('00000000-0000-0000-0000-0000000000a2', 'Noch Nicht Geprueft e.V.', 'Halle', 'DE', 'Education',
   'onboarding', 'x@x.test', '+49 222', 'Herr X', 'Xweg 2');

insert into needs (ngo_id, title, category, quantity, country, state) values
  ('00000000-0000-0000-0000-0000000000a1', 'Tablets for education', 'Education', 20, 'DE', 'open'),
  ('00000000-0000-0000-0000-0000000000a1', 'Schon vergeben', 'Education', 5, 'DE', 'fulfilled'),
  ('00000000-0000-0000-0000-0000000000a2', 'Laptops', 'Education', 10, 'DE', 'open');

-- 1. The gate is named after what it gates ---------------------------------

select is(
  (select ngo_contact_access from plan_entitlements where plan = 'registered'),
  false,
  'registered has no contact access'
);

select is(
  (select count(*)::int from plan_entitlements where plan in ('seed', 'tree') and not ngo_contact_access),
  0,
  'paid tiers have contact access'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_name = 'plan_entitlements' and column_name = 'ngo_visibility'
  ),
  'the misnamed ngo_visibility column is gone'
);

select ok(
  to_regprocedure('ngo_needs_overview(int)') is null,
  'the moot aggregate is gone — it showed less than the public landing page'
);

-- 2. Signing in is not a downgrade: the directory shows what the LP shows ---

select tests_authenticate('00000000-0000-0000-0000-00000000c201');

-- 0021: the directory is anonymised. The need is visible with focus and
-- country, but nothing identifies the organisation.
select is(
  (select ngo_focus from open_needs_directory() where title = 'Tablets for education'),
  'Education',
  'an unpaid corporate sees the need with an anonymous descriptor (focus, country)'
);

select ok(
  not exists (
    select 1 from information_schema.columns
    where table_name = 'open_needs_directory' and column_name in ('ngo_name', 'ngo_city')
  ),
  'the directory has no name or city column — identity is what a plan unlocks'
);

select ok(
  not exists (select 1 from open_needs_directory() where title = 'Schon vergeben'),
  'only open needs appear'
);

select is(
  (select count(*)::int from open_needs_directory() where title = 'Laptops'),
  0,
  'unverified NGOs'' needs are not part of the verified network on show'
);

-- 3. Contacts stay behind the gate -----------------------------------------
-- The directory's column list is the boundary. If someone adds a contact
-- column to it, this fails.

select is(
  (select count(*)::int from information_schema.columns
   where table_name = 'open_needs_directory'
     and column_name in ('contact_email', 'contact_phone', 'board_contact', 'address',
                         'ngo_contact_email', 'ngo_contact_phone')),
  0,
  'the directory exposes no contact column'
);

select is(
  (select count(*)::int from ngos),
  0,
  'an unpaid corporate still reads no ngos row directly — contacts stay unreachable'
);

select is(
  (select count(*)::int from needs),
  0,
  'needs_visible is untouched: the directory is the only browse surface, matching still gates the rest'
);

select tests_clear_auth();

select * from finish();

rollback;

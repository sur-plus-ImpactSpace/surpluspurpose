-- pgTAP tests for claim_workspace (0019) — the self-service end of the funnel.
-- Run locally: supabase test db
-- Everything runs in one transaction and rolls back.

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

-- Seed: three confirmed auth users with different requested roles. Registration
-- metadata now also carries the person (0022: salutation/name) and, for NGOs,
-- the organisation type (0023: org_type) — claim_workspace validates them.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d301', 'corp-signup@test.dev',
   '{"requested_role": "corporate", "salutation": "herr", "academic_title": "Dr.", "first_name": "Max", "last_name": "Muster"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d302', 'ngo-signup@test.dev',
   '{"requested_role": "ngo", "salutation": "frau", "first_name": "Nora", "last_name": "Helfer", "org_type": "verein"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d303', 'sneaky@test.dev',
   '{"requested_role": "admin"}'::jsonb);

-- 1. Corporate claims a workspace ------------------------------------------

select tests_authenticate('00000000-0000-0000-0000-00000000d301');

select lives_ok(
  $$ select claim_workspace('Beispiel GmbH') $$,
  'a confirmed corporate signup can claim a workspace'
);

select is(
  (select role::text from users where id = '00000000-0000-0000-0000-00000000d301'),
  'corporate',
  'the users row carries the requested role'
);

select is(
  (select c.plan::text from companies c
   join users u on u.company_id = c.id
   where u.id = '00000000-0000-0000-0000-00000000d301'),
  'registered',
  'a self-provisioned company lands on registered — never on a paying tier'
);

select throws_ok(
  $$ select claim_workspace('Beispiel GmbH Zwei') $$,
  'user_already_provisioned',
  'claiming twice is refused'
);

-- 2. NGO claims a workspace --------------------------------------------------

select tests_authenticate('00000000-0000-0000-0000-00000000d302');

select lives_ok(
  $$ select claim_workspace('Hilfe e.V.') $$,
  'a confirmed NGO signup can claim a workspace'
);

select is(
  (select g.verification_state::text from ngos g
   join users u on u.ngo_id = g.id
   where u.id = '00000000-0000-0000-0000-00000000d302'),
  'onboarding',
  'a self-provisioned NGO starts unverified — presence, never trust'
);

-- 3. The gates ---------------------------------------------------------------

select tests_authenticate('00000000-0000-0000-0000-00000000d303');

select throws_ok(
  $$ select claim_workspace('Evil Ops') $$,
  'no_requested_role',
  'a self-declared admin role is never provisioned'
);

select throws_ok(
  $$ select claim_workspace('') $$,
  'no_requested_role',
  'the role gate fires before name validation — nothing leaks about why'
);

select tests_authenticate('00000000-0000-0000-0000-00000000d302');
select tests_clear_auth();

select throws_ok(
  $$ select claim_workspace('Anon GmbH') $$,
  'not_authenticated',
  'no session, no workspace'
);

-- Org name validation, checked via a fresh corporate signup.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d304', 'short@test.dev',
   '{"requested_role": "corporate"}'::jsonb);
select tests_authenticate('00000000-0000-0000-0000-00000000d304');

select throws_ok(
  $$ select claim_workspace('x') $$,
  'invalid_org_name',
  'a one-character organisation name is rejected'
);

-- Person fields and org type are persisted (0022 / 0023) ---------------------

select is(
  (select full_name from users where id = '00000000-0000-0000-0000-00000000d301'),
  'Dr. Max Muster',
  'academic title + first + last name compose full_name'
);

select is(
  (select g.org_type::text from ngos g
   join users u on u.ngo_id = g.id
   where u.id = '00000000-0000-0000-0000-00000000d302'),
  'verein',
  'the NGO org_type from signup metadata is stored'
);

-- Negative cases for the tightened contract ----------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d305', 'ngo-notype@test.dev',
   '{"requested_role": "ngo", "salutation": "frau", "first_name": "A", "last_name": "B"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d306', 'bad-sal@test.dev',
   '{"requested_role": "corporate", "salutation": "hello", "first_name": "A", "last_name": "B"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d307', 'no-name@test.dev',
   '{"requested_role": "corporate", "salutation": "herr", "first_name": "A"}'::jsonb);

select tests_authenticate('00000000-0000-0000-0000-00000000d305');
select throws_ok(
  $$ select claim_workspace('Kein Typ e.V.') $$,
  'invalid_org_type',
  'an NGO without a valid org_type is refused'
);

select tests_authenticate('00000000-0000-0000-0000-00000000d306');
select throws_ok(
  $$ select claim_workspace('Falsche Anrede GmbH') $$,
  'invalid_salutation',
  'a salutation outside herr/frau/divers is refused'
);

select tests_authenticate('00000000-0000-0000-0000-00000000d307');
select throws_ok(
  $$ select claim_workspace('Ohne Nachname GmbH') $$,
  'invalid_name',
  'a missing last name is refused'
);

-- Free mail (0031, REQ-AUTH-03) --------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000d308', 'Max.Muster@GMAIL.com',
   '{"requested_role": "corporate", "salutation": "herr", "first_name": "Max", "last_name": "Muster"}'::jsonb),
  ('00000000-0000-0000-0000-00000000d309', 'verein@web.de',
   '{"requested_role": "ngo", "salutation": "frau", "first_name": "Vera", "last_name": "Verein", "org_type": "verein"}'::jsonb);

select tests_authenticate('00000000-0000-0000-0000-00000000d308');
select throws_ok(
  $$ select claim_workspace('Gmail GmbH') $$,
  'freemail_not_allowed',
  'a corporate signup from a free-mail domain is refused'
);
select is(
  (select count(*)::int from users where id = '00000000-0000-0000-0000-00000000d308'),
  0,
  'the refused corporate gets no users row'
);

select tests_authenticate('00000000-0000-0000-0000-00000000d309');
select lives_ok(
  $$ select claim_workspace('Kleiner Verein e.V.') $$,
  'an NGO may still register with free mail'
);

select tests_clear_auth();

select * from finish();

rollback;

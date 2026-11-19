-- pgTAP tests for set_company_plan (0020).
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

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
  ('00000000-0000-0000-0000-00000000f401', 'ops@test.dev'),
  ('00000000-0000-0000-0000-00000000f402', 'corp@test.dev');

insert into companies (id, name) values
  ('00000000-0000-0000-0000-0000000000b1', 'Claimed GmbH');

insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000f401', 'ops@test.dev', 'admin', null),
  ('00000000-0000-0000-0000-00000000f402', 'corp@test.dev', 'corporate',
   '00000000-0000-0000-0000-0000000000b1');

-- The state a self-provisioned company starts in.
select is(
  (select plan::text from companies where id = '00000000-0000-0000-0000-0000000000b1'),
  'registered',
  'a claimed company starts on registered'
);

-- 1. Only Ops -----------------------------------------------------------------

select tests_authenticate('00000000-0000-0000-0000-00000000f402');

select throws_ok(
  $$ select set_company_plan('00000000-0000-0000-0000-0000000000b1', 'tree') $$,
  'forbidden',
  'a corporate cannot upgrade itself — this is the paywall'
);

select is(
  (select plan::text from companies where id = '00000000-0000-0000-0000-0000000000b1'),
  'registered',
  'and the refused attempt changed nothing'
);

-- 2. Ops can ------------------------------------------------------------------

select tests_authenticate('00000000-0000-0000-0000-00000000f401');

select lives_ok(
  $$ select set_company_plan('00000000-0000-0000-0000-0000000000b1', 'seed') $$,
  'Ops moves a paying customer onto Seed'
);

select is(
  (select plan::text from companies where id = '00000000-0000-0000-0000-0000000000b1'),
  'seed',
  'the plan is what Ops set'
);

select ok(
  exists (
    select 1 from audit_events
    where action = 'company.plan_set:seed'
      and target = '00000000-0000-0000-0000-0000000000b1'
  ),
  'the change is audited — plan is the only record of who pays'
);

-- 3. Guards -------------------------------------------------------------------

select throws_ok(
  $$ select set_company_plan('00000000-0000-0000-0000-0000000000b1', 'enterprise') $$,
  'invalid_plan',
  'an unknown plan is refused'
);

-- Seed allows 2 corporate seats; fill them, then try to downgrade to
-- registered, which allows 1.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000f403', 'corp2@test.dev');
insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000f403', 'corp2@test.dev', 'corporate',
   '00000000-0000-0000-0000-0000000000b1');

select throws_ok(
  $$ select set_company_plan('00000000-0000-0000-0000-0000000000b1', 'registered') $$,
  'seat_limit_exceeded',
  'a downgrade that would strand users is refused rather than silently applied'
);

select * from finish();

rollback;

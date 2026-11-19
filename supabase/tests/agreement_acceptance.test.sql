-- pgTAP tests for clickwrap acceptance (migration 0010).
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

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
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'tree');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null);

select tests_authenticate('00000000-0000-0000-0000-00000000c001');

select lives_ok(
  $$ select accept_agreement('saas_terms', '2026-07') $$,
  'corporate accepts the SaaS terms'
);
select is(
  (select count(*)::int from agreement_acceptances
    where company_id = '00000000-0000-0000-0000-0000000000c1'
      and kind = 'saas_terms' and version = '2026-07'),
  1,
  'acceptance recorded for the company + version'
);
select is(
  (select count(*)::int from agreement_acceptances
    where actor_user = '00000000-0000-0000-0000-00000000c001'),
  1,
  'acceptance attributed to the accepting user'
);

select * from finish();

rollback;

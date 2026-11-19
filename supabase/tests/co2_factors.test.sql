-- pgTAP: only Ops edits the CO2 table, and every change is logged (0054). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev'),
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev');
insert into companies (id, name, plan) values ('00000000-0000-0000-0000-0000000000c1', 'Acme', 'seed');
insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null),
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1');

create or replace function as_user(p uuid, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

select as_user('00000000-0000-0000-0000-00000000c001');
select throws_ok($$ select set_co2_factor('IT', 2.5) $$, 'P0001', 'actor_not_allowed', 'a company cannot edit the table');
select as_user('00000000-0000-0000-0000-00000000ad01', 'aal1');
select throws_ok($$ select set_co2_factor('IT', 2.5) $$, 'P0001', 'actor_not_available', 'Ops below aal2 cannot edit it');

select as_user('00000000-0000-0000-0000-00000000ad01');
select is((select kg_co2e_per_kg from set_co2_factor('IT', 2.5)), 2.5, 'Ops sets a factor');
select is((select kg_co2e_per_kg from set_co2_factor('  IT ', 3.25)), 3.25, 'and changes it (category trimmed)');
select is((select count(*)::int from co2_factors), 1, 'one row per category');
select is(
  (select array_agg(action order by id) from audit_events where target = 'IT' and action like 'co2_factor.set:%'),
  array['co2_factor.set:none->2.500', 'co2_factor.set:2.500->3.250'],
  'each change is logged with the old and the new value'
);
select throws_ok($$ select set_co2_factor('IT', -1) $$, 'P0001', 'invalid_factor', 'negative factors are refused');
select throws_ok($$ select set_co2_factor('IT', 5000) $$, 'P0001', 'invalid_factor', 'absurd factors are refused');
select throws_ok($$ select set_co2_factor('  ', 1) $$, 'P0001', 'invalid_category', 'a category is required');
select is((select updated_by from co2_factors where category = 'IT'), '00000000-0000-0000-0000-00000000ad01'::uuid, 'who changed it is kept');

select * from finish();
rollback;

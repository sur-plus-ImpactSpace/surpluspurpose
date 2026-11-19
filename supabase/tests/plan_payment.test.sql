-- pgTAP: a paid checkout activates a plan once, only upwards, service role only (0053). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Reg', 'registered'),
  ('00000000-0000-0000-0000-0000000000c2', 'Tree', 'tree');

select is(activate_company_plan_from_payment('00000000-0000-0000-0000-0000000000c1', 'seed', 'evt_1'), true, 'a paid checkout activates Seed');
select is((select plan::text from companies where id = '00000000-0000-0000-0000-0000000000c1'), 'seed', 'the plan changed');
select is((select contract_started_at from companies where id = '00000000-0000-0000-0000-0000000000c1'), current_date, 'the contract year starts at the first purchase');
select is(activate_company_plan_from_payment('00000000-0000-0000-0000-0000000000c1', 'tree', 'evt_1'), false, 'a redelivered event does nothing');
select is((select plan::text from companies where id = '00000000-0000-0000-0000-0000000000c1'), 'seed', 'and the plan is unchanged');
select is(activate_company_plan_from_payment('00000000-0000-0000-0000-0000000000c1', 'tree', 'evt_2'), true, 'upgrading to Tree works');
select is(activate_company_plan_from_payment('00000000-0000-0000-0000-0000000000c2', 'seed', 'evt_3'), false, 'a late Seed payment never downgrades Tree');
select throws_ok($$ select activate_company_plan_from_payment('00000000-0000-0000-0000-0000000000c1', 'registered', 'evt_4') $$, 'P0001', 'invalid_plan', 'only paid plans can be bought');
select throws_ok($$ select activate_company_plan_from_payment('00000000-0000-0000-0000-0000000000f9', 'seed', 'evt_5') $$, 'P0001', 'company_not_found', 'unknown company');
select ok(
  not has_function_privilege('authenticated', 'activate_company_plan_from_payment(uuid,text,text)', 'execute')
    and has_function_privilege('service_role', 'activate_company_plan_from_payment(uuid,text,text)', 'execute'),
  'only the service role can activate a plan'
);

select * from finish();
rollback;

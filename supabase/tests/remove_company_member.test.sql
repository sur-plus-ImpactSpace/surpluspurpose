-- pgTAP: removing a colleague frees the seat (0050). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000c002', 'b@test.dev'),
  ('00000000-0000-0000-0000-00000000c003', 'other@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'One', 'seed'),
  ('00000000-0000-0000-0000-0000000000c2', 'Two', 'seed');
insert into ngos (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'NGO');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'a@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000c002', 'b@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000c003', 'other@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c2', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e001', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select throws_ok($$ select remove_company_member('00000000-0000-0000-0000-00000000c002') $$, 'P0001', 'actor_not_allowed', 'an NGO user cannot remove company members');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000c001', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select throws_ok($$ select remove_company_member('00000000-0000-0000-0000-00000000c001') $$, 'P0001', 'cannot_remove_self', 'nobody removes themselves');
select throws_ok($$ select remove_company_member('00000000-0000-0000-0000-00000000c003') $$, 'P0001', 'member_not_found', 'a member of another company is out of reach');
select lives_ok($$ select remove_company_member('00000000-0000-0000-0000-00000000c002') $$, 'a colleague is removed from the company');
select is((select count(*)::int from users where company_id = '00000000-0000-0000-0000-0000000000c1'), 1, 'the seat is free again');
select is((select count(*)::int from audit_events where action = 'member.removed'), 1, 'the removal is audited');
select is((select count(*)::int from users where id = '00000000-0000-0000-0000-00000000c002'), 0, 'the workspace profile is gone');

select * from finish();
rollback;

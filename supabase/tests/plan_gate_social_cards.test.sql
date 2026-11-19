-- pgTAP: social media cards are Tree only, enforced by the database (0051). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'reg@test.dev'),
  ('00000000-0000-0000-0000-00000000c002', 'seed@test.dev'),
  ('00000000-0000-0000-0000-00000000c003', 'tree@test.dev');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Registered', 'registered'),
  ('00000000-0000-0000-0000-0000000000c2', 'Seed', 'seed'),
  ('00000000-0000-0000-0000-0000000000c3', 'Tree', 'tree');
insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000c001', 'reg@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-00000000c002', 'seed@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-00000000c003', 'tree@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c3');

insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c2', 'Seed listing', 'IT', 1, 'open');

insert into ngos (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'NGO');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Need', 'IT', 'open');
insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1', 1, 'proposed');

create or replace function as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

select as_user('00000000-0000-0000-0000-00000000c001');
select throws_ok($$ select create_agent_run('social_ad', 'Draft an impact card') $$, 'P0001', 'plan_required', 'registered cannot create social cards');
select as_user('00000000-0000-0000-0000-00000000c002');
select throws_ok($$ select create_agent_run('social_ad', 'Draft an impact card') $$, 'P0001', 'plan_required', 'Seed cannot create social cards');
select lives_ok($$ select create_agent_run('message_draft', 'Draft a reply', 'match', '00000000-0000-0000-0000-0000000000a1') $$, 'Seed can still use the other copilot tasks');
select as_user('00000000-0000-0000-0000-00000000c003');
select lives_ok($$ select create_agent_run('social_ad', 'Draft an impact card') $$, 'Tree can create social cards');
select is((select count(*)::int from agent_runs where task_type = 'social_ad'), 1, 'only the Tree run exists');

select * from finish();
rollback;

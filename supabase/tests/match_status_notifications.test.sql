-- pgTAP: both sides are told about every status change (0043). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');
insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme', 'tree', 'verified');
insert into ngos (id, name, verification_state) values
  ('00000000-0000-0000-0000-0000000000e1', 'NGO', 'verified');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'L', 'IT', 5, 'open');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'N', 'IT', 'open');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000ad01', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from notifications where kind = 'match_status'), 2, 'a proposal notifies the company and the NGO');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e001', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select transition_match((select id from matches limit 1), 'ngo_confirmed');
select is((select count(*)::int from notifications where title = 'The NGO confirmed the match'), 2, 'a transition notifies both sides');

select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000ad01', 'role', 'authenticated', 'aal', 'aal2')::text, true);
select transition_match((select id from matches limit 1), 'cancelled');
select is((select count(*)::int from notifications where title = 'The match was cancelled'), 2, 'a cancellation notifies both sides');
select is((select count(*)::int from notifications where user_id = '00000000-0000-0000-0000-00000000ad01'), 0, 'Ops is not a party and gets nothing');

update matches set state = 'proposed', created_at = now() - interval '20 days';
select expire_stale_proposals();
select is((select count(*)::int from notifications where title = 'The proposal expired'), 2, 'an expiry notifies both sides');
select is((select count(*)::int from notifications), 8, 'one notification per user and distinct status, none repeated');

select * from finish();
rollback;

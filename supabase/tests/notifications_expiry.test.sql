-- pgTAP: proposal expiry warning and notification privacy (0042). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000e002', 'other@test.dev');
insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme', 'tree', 'verified');
insert into ngos (id, name, verification_state) values
  ('00000000-0000-0000-0000-0000000000e1', 'NGO One', 'verified'),
  ('00000000-0000-0000-0000-0000000000e2', 'NGO Two', 'verified');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000e002', 'other@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e2');
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Old', 'IT', 1, 'match_pending'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'Fresh', 'IT', 1, 'match_pending');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'N1', 'IT', 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'N2', 'IT', 'open');
insert into matches (id, listing_id, need_id, quantity, state, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'proposed', now() - interval '12 days'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d2', 1, 'proposed', now() - interval '5 days');

-- Inserting the matches already notified (0043); this test is about the expiry warning only.
delete from notifications;

select is(warn_expiring_proposals(), 1, 'only the proposal inside the warning window is warned');
select is((select count(*)::int from notifications where match_id = '00000000-0000-0000-0000-0000000000a1'), 2, 'both sides are notified (company user and NGO user)');
select is((select count(*)::int from notifications where match_id = '00000000-0000-0000-0000-0000000000a2'), 0, 'a young proposal is not warned about');
select is(warn_expiring_proposals(), 1, 'the job finds it again...');
select is((select count(*)::int from notifications), 2, '...but never repeats a reminder');
select is((select count(*)::int from notifications where user_id = '00000000-0000-0000-0000-00000000e002'), 0, 'an unrelated NGO is not notified');

grant select on notifications to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e001', 'role', 'authenticated')::text, true);
select is((select count(*)::int from notifications), 1, 'a user reads only their own notifications');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000e002', 'role', 'authenticated')::text, true);
select is((select count(*)::int from notifications), 0, 'another user sees none');
reset role;
select * from finish();
rollback;

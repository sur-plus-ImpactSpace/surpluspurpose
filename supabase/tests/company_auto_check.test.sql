-- pgTAP: automatic company check (0044). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev');
insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Pass GmbH', 'registered', 'onboarding'),
  ('00000000-0000-0000-0000-0000000000c2', 'Doubt GmbH', 'registered', 'onboarding'),
  ('00000000-0000-0000-0000-0000000000c3', 'Rejected GmbH', 'registered', 'rejected');
insert into users (id, email, role, company_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1');

select is(
  (select outcome from record_company_check('00000000-0000-0000-0000-0000000000c1', 'DE123456789', 'https://pass.de', true, 'PASS GMBH', true, true)),
  'approved', 'all three checks pass: approved'
);
select is((select verification_state::text from companies where id = '00000000-0000-0000-0000-0000000000c1'), 'verified', 'the company is verified automatically');
select is((select vat_id from companies where id = '00000000-0000-0000-0000-0000000000c1'), 'DE123456789', 'the VAT ID is kept');
select is((select count(*)::int from audit_events where action = 'company.auto_verified'), 1, 'auto-approval is audited');

select is(
  (select outcome from record_company_check('00000000-0000-0000-0000-0000000000c2', 'DE000000000', 'https://doubt.de', false, null, true, true)),
  'manual_review', 'one failed check: manual review'
);
select is((select verification_state::text from companies where id = '00000000-0000-0000-0000-0000000000c2'), 'review', 'the company waits for Ops');

select is(
  (select outcome from record_company_check('00000000-0000-0000-0000-0000000000c3', 'DE123456789', 'https://pass.de', true, 'X', true, true)),
  'approved', 'the check itself passes for a rejected company...'
);
select is((select verification_state::text from companies where id = '00000000-0000-0000-0000-0000000000c3'), 'rejected', '...but a company Ops rejected is never auto-approved');

select throws_ok(
  $$ select record_company_check('00000000-0000-0000-0000-0000000000f9', 'DE1', 'x', true, null, true, true) $$,
  'P0001', 'company_not_found', 'unknown company'
);
select ok(
  not has_function_privilege('authenticated', 'record_company_check(uuid,text,text,boolean,text,boolean,boolean)', 'execute')
    and not has_function_privilege('anon', 'record_company_check(uuid,text,text,boolean,text,boolean,boolean)', 'execute'),
  'user sessions cannot record a check'
);
select ok(
  has_function_privilege('service_role', 'record_company_check(uuid,text,text,boolean,text,boolean,boolean)', 'execute'),
  'the service role can'
);

select * from finish();
rollback;

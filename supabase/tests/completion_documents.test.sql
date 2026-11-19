-- pgTAP tests for the M2 completion-document hook (migration 0004).
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

create or replace function tests_authenticate(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user, 'role', 'authenticated', 'aal', 'aal2',
      -- a session established by an email link a moment ago (step-up, 0037)
      'amr', json_build_array(json_build_object('method', 'otp', 'timestamp', extract(epoch from now())::bigint))
    )::text,
    true
  );
end $$;

-- Seed
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');

insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'tree');

insert into ngos (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Kleiderkammer Test e.V.');

-- Matching needs verified organisations (0038).
update companies set verification_state = 'verified';
update ngos set verification_state = 'verified';

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null);

insert into listings (id, company_id, title, category, quantity, unit_value, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'ThinkPads', 'IT', 200, 71, 'match_pending');

insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Laptops', 'IT', 'open');

insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'proposed');

-- Pre-existing draft certificate: must be PROMOTED, not duplicated.
insert into documents (id, kind, title, status, company_id, match_id) values
  ('00000000-0000-0000-0000-00000000dc01', 'certificate', 'Draft cert', 'draft',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');

-- Walk the match to completed.
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'ngo_confirmed') $$, 'ngo confirms');
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
-- Clickwrap gate (0012): the corporate must accept the SaaS terms before confirming.
select accept_agreement('saas_terms', (select current_version from agreement_requirements where kind = 'saas_terms'));
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'both_confirmed') $$, 'corporate confirms');
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'in_transit') $$, 'admin pickup');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'delivered') $$, 'admin delivery');
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') $$, 'ngo receipt');

-- Assertions: the certificate lands as a countersign-pending draft (in_review),
-- the CSRD note is approved, then the NGO counter-signs it → published.
select is(
  (select count(*)::int from documents
    where match_id = '00000000-0000-0000-0000-0000000000a1'
      and kind = 'certificate' and status = 'in_review' and published_at is null),
  1,
  'draft certificate promoted to in_review (awaits NGO countersign), no duplicate'
);
select is(
  (select count(*)::int from documents
    where match_id = '00000000-0000-0000-0000-0000000000a1'
      and kind = 'report' and status = 'approved'
      and title = 'CSRD evidence note · ThinkPads'),
  1,
  'CSRD note created and approved on completion'
);

-- Only the match's NGO may counter-sign: the corporate is rejected.
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select confirm_donation_certificate('00000000-0000-0000-0000-00000000dc01') $$,
  'actor_not_allowed',
  'corporate cannot counter-sign the certificate'
);

-- The NGO counter-signs the Muster → published, releasing it to the corporate.
-- Clickwrap gate (0012): the NGO must accept the partner agreement first.
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select accept_agreement('ngo_partner_agreement', (select current_version from agreement_requirements where kind = 'ngo_partner_agreement'));
select lives_ok(
  $$ select confirm_donation_certificate('00000000-0000-0000-0000-00000000dc01') $$,
  'ngo counter-signs the certificate'
);
select is(
  (select status::text from documents where id = '00000000-0000-0000-0000-00000000dc01'),
  'published',
  'certificate published after NGO countersign'
);

select * from finish();

rollback;

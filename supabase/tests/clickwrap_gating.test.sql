-- pgTAP tests for the clickwrap gate (migration 0012).
-- The two commercially binding actions are blocked until the current agreement
-- version is accepted: corporate match-confirm (saas_terms) and NGO certificate
-- countersign (ngo_partner_agreement).
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

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
insert into documents (id, kind, title, status, company_id, match_id) values
  ('00000000-0000-0000-0000-00000000dc01', 'certificate', 'Draft cert', 'draft',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');

-- NGO confirms fit (not gated).
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'ngo_confirmed') $$, 'ngo confirms fit (ungated)');

-- Corporate cannot confirm the match without accepting the SaaS terms.
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'both_confirmed') $$,
  'agreement_required',
  'corporate match-confirm is blocked until SaaS terms accepted'
);

-- After accepting, the same confirm succeeds.
select accept_agreement('saas_terms', (select current_version from agreement_requirements where kind = 'saas_terms'));
select lives_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'both_confirmed') $$,
  'corporate confirms after accepting the SaaS terms'
);

-- Walk to delivered (admin), then completed (ngo) — these steps are ungated.
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'in_transit') $$, 'admin pickup');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'delivered') $$, 'admin delivery');
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok($$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'completed') $$, 'ngo confirms receipt (ungated)');

-- The certificate is now in_review. The NGO cannot counter-sign without the
-- partner agreement (the actor check passes; the agreement gate does not).
select throws_ok(
  $$ select confirm_donation_certificate('00000000-0000-0000-0000-00000000dc01') $$,
  'agreement_required',
  'ngo countersign is blocked until the partner agreement is accepted'
);

-- After accepting, the countersign succeeds and publishes the certificate.
select accept_agreement('ngo_partner_agreement', (select current_version from agreement_requirements where kind = 'ngo_partner_agreement'));
select lives_ok(
  $$ select confirm_donation_certificate('00000000-0000-0000-0000-00000000dc01') $$,
  'ngo counter-signs after accepting the partner agreement'
);
select is(
  (select status::text from documents where id = '00000000-0000-0000-0000-00000000dc01'),
  'published',
  'certificate published after gated countersign'
);

select * from finish();

rollback;

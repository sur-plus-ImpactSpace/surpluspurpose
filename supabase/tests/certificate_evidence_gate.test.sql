-- pgTAP tests for the Wert-Beleg-Tor on countersign (migration 0028).
-- The NGO may only counter-sign a donation certificate (in_review → published)
-- once at least one evidence upload exists on the same match.
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

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

-- Seed a corporate + NGO with a match, and a countersign-pending certificate.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'tree');
insert into ngos (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Kleiderkammer Test e.V.');

-- Matching needs verified organisations (0038).
update companies set verification_state = 'verified';
update ngos set verification_state = 'verified';
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1');
insert into listings (id, company_id, title, category, quantity, unit_value, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'ThinkPads', 'IT', 200, 71, 'completed');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Laptops', 'IT', 'fulfilled');
insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'completed');

-- The countersign-pending donation certificate Muster (in_review).
insert into documents (id, kind, title, status, company_id, match_id) values
  ('00000000-0000-0000-0000-00000000dc01', 'certificate', 'Donation certificate', 'in_review',
   '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');

-- Clickwrap gate (0012): the NGO accepts the partner agreement first.
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select accept_agreement('ngo_partner_agreement', (select current_version from agreement_requirements where kind = 'ngo_partner_agreement'));

-- Without any evidence on the match, countersign is blocked.
select throws_ok(
  $$ select confirm_donation_certificate('00000000-0000-0000-0000-00000000dc01') $$,
  'evidence_required',
  'countersign blocked while no evidence exists on the match'
);
select is(
  (select status::text from documents where id = '00000000-0000-0000-0000-00000000dc01'),
  'in_review',
  'certificate stays in_review after the blocked countersign'
);

-- The corporate attaches one evidence upload on the match.
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select add_match_evidence(
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-00000000c001/00000000-0000-0000-0000-0000000000a1/note.pdf',
  'Delivery note', 'application/pdf', 12345
);

-- Now the NGO can counter-sign the Muster → published.
select tests_authenticate('00000000-0000-0000-0000-00000000e001');
select lives_ok(
  $$ select confirm_donation_certificate('00000000-0000-0000-0000-00000000dc01') $$,
  'countersign succeeds once at least one evidence exists'
);
select is(
  (select status::text from documents where id = '00000000-0000-0000-0000-00000000dc01'),
  'published',
  'certificate published after NGO countersign with evidence present'
);

select * from finish();

rollback;

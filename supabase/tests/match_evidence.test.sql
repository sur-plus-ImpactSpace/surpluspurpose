-- pgTAP tests for private match-evidence upload (migration 0007).
-- Run locally: supabase test db

begin;

create extension if not exists pgtap with schema extensions;

select plan(2);

create or replace function tests_authenticate(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end $$;

-- Seed a corporate + NGO with a match between their listing/need.
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
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'ThinkPads', 'IT', 200, 71, 'confirmed');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'Laptops', 'IT', 'matched');
insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'both_confirmed');

-- A participant (the corporate on the match) attaches evidence.
select tests_authenticate('00000000-0000-0000-0000-00000000c001');
select lives_ok(
  $$ select add_match_evidence(
       '00000000-0000-0000-0000-0000000000a1',
       '00000000-0000-0000-0000-00000000c001/00000000-0000-0000-0000-0000000000a1/note.pdf',
       'Delivery note', 'application/pdf', 12345
     ) $$,
  'a match participant attaches evidence'
);
select is(
  (select count(*)::int from documents
    where match_id = '00000000-0000-0000-0000-0000000000a1'
      and kind = 'upload'
      and storage_path = '00000000-0000-0000-0000-00000000c001/00000000-0000-0000-0000-0000000000a1/note.pdf'
      and company_id = '00000000-0000-0000-0000-0000000000c1'),
  1,
  'evidence recorded as an upload document owned by the company'
);

select * from finish();

rollback;

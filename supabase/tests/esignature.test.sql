-- pgTAP: e-signature envelopes move only through the DocuSeal webhook function (0055). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev'),
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev'),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev'),
  ('00000000-0000-0000-0000-00000000c009', 'stranger@test.dev');
insert into companies (id, name, plan, verification_state) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme', 'tree', 'verified'),
  ('00000000-0000-0000-0000-0000000000c9', 'Stranger', 'tree', 'verified');
insert into ngos (id, name, verification_state) values ('00000000-0000-0000-0000-0000000000e1', 'NGO', 'verified');
insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin', null, null),
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null),
  ('00000000-0000-0000-0000-00000000e001', 'ngo@test.dev', 'ngo', null, '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-00000000c009', 'stranger@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c9', null);
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'L', 'IT', 5, 'confirmed');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'N', 'IT', 'open');
insert into matches (id, listing_id, need_id, quantity, state) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 5, 'completed');
insert into documents (id, kind, title, status, company_id, match_id) values
  ('00000000-0000-0000-0000-0000000000f1', 'certificate', 'Cert', 'approved', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000f2', 'report', 'Note', 'approved', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1');

create or replace function as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated', 'aal', 'aal2')::text, true);
end $$;

-- 1) Who may send a document for signing ------------------------------------
select as_user('00000000-0000-0000-0000-00000000c001');
select throws_ok($$ select create_signature_envelope('00000000-0000-0000-0000-0000000000f1', 'sub_1', 'Cert', 'Acme', 'a@acme.de', 'NGO', 'n@ngo.org') $$, 'P0001', 'actor_not_allowed', 'a company cannot start the signing');
select as_user('00000000-0000-0000-0000-00000000ad01');
select throws_ok($$ select create_signature_envelope('00000000-0000-0000-0000-0000000000f2', 'sub_1', 'Note', 'Acme', 'a@acme.de', 'NGO', 'n@ngo.org') $$, 'P0001', 'not_signable', 'only certificates are signed');
select throws_ok($$ select create_signature_envelope('00000000-0000-0000-0000-0000000000f1', 'sub_1', 'Cert', 'Acme', '', 'NGO', 'n@ngo.org') $$, 'P0001', 'invalid_envelope', 'both signers need an email');
select is((select state from create_signature_envelope('00000000-0000-0000-0000-0000000000f1', 'sub_1', 'Cert', 'Acme', 'A@Acme.de', 'NGO', 'n@ngo.org') e), 'sent'::envelope_state, 'Ops sends the certificate for signing');
select is((select count(*)::int from envelope_recipients), 2, 'with a signer for each side');
select throws_ok($$ select create_signature_envelope('00000000-0000-0000-0000-0000000000f1', 'sub_2', 'Cert', 'Acme', 'a@acme.de', 'NGO', 'n@ngo.org') $$, 'P0001', 'envelope_exists', 'one live envelope per document');

-- 2) The parties see it, strangers do not -----------------------------------
-- Hosted Supabase grants table privileges to authenticated and lets row security
-- decide; model that here (rolled back).
grant select on documents to authenticated;
set local role authenticated;
select as_user('00000000-0000-0000-0000-00000000c001');
select is((select count(*)::int from signature_envelopes), 1, 'the company sees its envelope');
select is((select count(*)::int from envelope_recipients), 2, 'and its signers');
select as_user('00000000-0000-0000-0000-00000000e001');
select is((select count(*)::int from signature_envelopes), 1, 'the NGO of the match sees it too');
select as_user('00000000-0000-0000-0000-00000000c009');
select is((select count(*)::int from signature_envelopes), 0, 'another company sees nothing');
select is((select count(*)::int from envelope_recipients), 0, 'nor the signers');
reset role;

-- 3) Only the webhook function moves it ----------------------------------------
select ok(
  not has_function_privilege('authenticated', 'apply_docuseal_event(text,text,text,text,text)', 'execute')
    and has_function_privilege('service_role', 'apply_docuseal_event(text,text,text,text,text)', 'execute'),
  'no user session can mark anything signed'
);
select is(apply_docuseal_event('sub_1', 'viewed', 'a@acme.de'), 'sent'::envelope_state, 'a view does not change the envelope state');
select is(apply_docuseal_event('sub_1', 'signed', 'A@acme.de'), 'partially_signed'::envelope_state, 'the first signature makes it partially signed');
select is(apply_docuseal_event('sub_1', 'signed', 'n@ngo.org'), 'completed'::envelope_state, 'the second one completes it');
select is(
  apply_docuseal_event('sub_1', 'completed', null, 'https://docuseal.com/audit/1', 'signed/sub_1.pdf'),
  'completed'::envelope_state, 'the signed copy can still be attached afterwards'
);
select is((select signed_storage_path from signature_envelopes where external_id = 'sub_1'), 'signed/sub_1.pdf', 'and its path is stored');
select is((select count(*)::int from audit_events where action = 'document.signed'), 1, 'completion is audited once');
select throws_ok($$ select apply_docuseal_event('sub_unknown', 'completed') $$, 'P0001', 'envelope_not_found', 'an unknown submission is refused');

select * from finish();
rollback;

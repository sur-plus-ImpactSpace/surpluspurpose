-- pgTAP tests for a1: perform_agent_action.execute creates a listing from an
-- approved surplus-intake proposed action (migration 0009).
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

-- Seed a corporate workspace.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev');

insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'tree');

insert into users (id, email, role, company_id, ngo_id) values
  ('00000000-0000-0000-0000-00000000c001', 'corp@test.dev', 'corporate', '00000000-0000-0000-0000-0000000000c1', null);

-- A Copilot surplus-intake run with one proposed listing (target_id is null =
-- create new). This mirrors what createSurplusIntakePlan produces.
insert into agent_runs (id, role, company_id, task_type, title, prompt, status, summary) values
  ('00000000-0000-0000-0000-0000000000f1', 'corporate', '00000000-0000-0000-0000-0000000000c1',
   'surplus_intake', 'Surplus intake', '[]', 'completed', 'Drafted from list');

insert into agent_proposed_actions
  (id, run_id, label, description, status, risk_level, target_type, target_id, proposed_payload)
values
  ('00000000-0000-0000-0000-00000000ac01', '00000000-0000-0000-0000-0000000000f1',
   'Create listing: Office chairs', 'from uploaded list', 'pending', 'medium', 'listing', null,
   '{"title":"Office chairs","category":"Furniture","quantity":12,"unitValue":30,"condition":"Good","city":"Munich","country":"Germany","eligibilityUsable":true,"eligibilityPolicyFit":true,"eligibilityOwnership":true}'::jsonb);

select tests_authenticate('00000000-0000-0000-0000-00000000c001');

-- Approve, then execute: execution must create the listing (human gate first).
select lives_ok(
  $$ select perform_agent_action('00000000-0000-0000-0000-00000000ac01', 'approve') $$,
  'corporate approves the surplus-intake action'
);
select lives_ok(
  $$ select perform_agent_action('00000000-0000-0000-0000-00000000ac01', 'execute') $$,
  'executing the approved action creates the listing'
);
select is(
  (select count(*)::int from listings
    where company_id = '00000000-0000-0000-0000-0000000000c1' and title = 'Office chairs'),
  1,
  'a listing was created from the proposed payload'
);
select is(
  (select status::text from agent_proposed_actions where id = '00000000-0000-0000-0000-00000000ac01'),
  'executed',
  'action is marked executed'
);

select * from finish();

rollback;

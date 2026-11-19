-- Staging seed for the M1 end-to-end login test.
-- Run AFTER migrations 0001–0003 in the Supabase SQL editor (staging project only!).
-- Idempotent: safe to re-run.
--
-- Deliberately NO rows in auth.users / public.users: real accounts are created
-- through the actual product flows (admin bootstrap, then invitations), because
-- that is exactly what M1 is supposed to exercise.

insert into companies (id, name, plan, city, country, owner_name, contact_email, contract_started_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'Acme Staging GmbH',
  'seed',
  'Munich',
  'Germany',
  'Staging Owner',
  'staging-corporate@surpluspurpose.com',
  current_date
)
on conflict (id) do nothing;

insert into ngos (id, name, city, country, focus, verification_state, trust_score, contact_email)
values (
  '22222222-2222-4222-8222-222222222222',
  'Kleiderkammer Staging e.V.',
  'Munich',
  'Germany',
  'Clothing Aid',
  'verified',
  80,
  'staging-ngo@surpluspurpose.com'
)
on conflict (id) do nothing;

insert into listings (id, company_id, title, category, subcategory, quantity, unit, unit_value,
                      city, country, condition, state, eligibility)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Staging ThinkPads',
  'IT & Electronics',
  'Laptops',
  20,
  'units',
  70,
  'Munich',
  'Germany',
  'Good',
  'match_pending',
  '{"usable": true, "policyFit": true, "ownership": true}'::jsonb
)
on conflict (id) do nothing;

insert into needs (id, ngo_id, title, category, quantity, city, country, beneficiaries, state, story)
values (
  '44444444-4444-4444-8444-444444444444',
  '22222222-2222-4222-8222-222222222222',
  'Laptops for staging classes',
  'IT & Electronics',
  20,
  'Munich',
  'Germany',
  60,
  'open',
  'Staging story: evening digital literacy classes.'
)
on conflict (id) do nothing;

insert into matches (id, listing_id, need_id, state, score, co2_tons)
values (
  '55555555-5555-4555-8555-555555555555',
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444',
  'proposed',
  92,
  1.4
)
on conflict (id) do nothing;

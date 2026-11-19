-- REQ-MATCH-09: allocation per position + organisation (ADR 0037).

begin;
select plan(13);

select ok(
  exists(
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'donation_allocations'
  ),
  'donation_allocations table exists'
);

select ok(
  exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'create_donation_allocation'
  ),
  'create_donation_allocation RPC exists'
);

select ok(
  exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'release_donation_allocation'
  ),
  'release_donation_allocation RPC exists'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_donation_allocation'
    limit 1) ~ 'donation_case_is_confirmed',
  'create_donation_allocation uses donation_case_is_confirmed gate'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_donation_allocation'
    limit 1) ~ 'case_not_confirmed',
  'create_donation_allocation raises case_not_confirmed'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_donation_allocation'
    limit 1) ~ 'quantity_exceeds_available',
  'create_donation_allocation enforces quantity cap'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'release_donation_allocation'
    limit 1) ~ 'invalid_release_note',
  'release_donation_allocation requires a written release note'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'reopen_donation_case_confirmation'
    limit 1) ~ 'allocated',
  'reopen_donation_case_confirmation clears allocated positions'
);

-- 0071: label snapshot so the NGO sees names without position/case RLS.
select has_column('public', 'donation_allocations', 'position_model', 'allocation stores position_model');
select has_column('public', 'donation_allocations', 'case_title', 'allocation stores case_title');

-- 0072 hardening.
select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_donation_allocation'
    limit 1) ~ 'company_not_verified',
  'create_donation_allocation refuses unverified companies'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'confirm_donation_case'
    limit 1) ~ 'donation_allocations',
  'confirm_donation_case restores allocated for positions with active claims'
);

-- 0073: only Ops allocates.
select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_donation_allocation'
    limit 1) !~ 'corporate',
  'create_donation_allocation is Ops-only (no corporate branch)'
);

select * from finish();
rollback;

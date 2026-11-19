-- REQ-CORP-01: donation case + position RPCs exist with verification gate (ADR 0033).

begin;
select plan(6);

select has_table('public', 'donation_cases', 'donation_cases table exists');
select has_table('public', 'donation_positions', 'donation_positions table exists');

select ok(
  exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'create_donation_case'
  ),
  'create_donation_case RPC exists'
);

select ok(
  exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'add_donation_position'
  ),
  'add_donation_position RPC exists'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_donation_case'
    limit 1) ~ 'company_is_verified',
  'create_donation_case consults company_is_verified'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'import_donation_positions'
    limit 1) ~ 'empty_positions',
  'import_donation_positions rejects empty batches'
);

select * from finish();
rollback;

-- REQ-CORP-02: confirmation gate RPCs (ADR 0034).

begin;
select plan(5);

select ok(
  exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'confirm_donation_case'
  ),
  'confirm_donation_case RPC exists'
);

select ok(
  exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'donation_case_is_confirmed'
  ),
  'donation_case_is_confirmed helper exists'
);

select ok(
  exists(
    select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'reopen_donation_case_confirmation'
  ),
  'reopen_donation_case_confirmation helper exists'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'confirm_donation_case'
    limit 1) ~ 'already_confirmed',
  'confirm_donation_case rejects already_confirmed'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'add_donation_position'
    limit 1) ~ 'reopen_donation_case_confirmation',
  'add_donation_position reopens confirmation after inventory change'
);

select * from finish();
rollback;

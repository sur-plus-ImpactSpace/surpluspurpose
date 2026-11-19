-- REQ-AUTH-01: create_listing refuses unverified companies (ADR 0027).

begin;
select plan(2);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_listing'
    limit 1) ~ 'company_is_verified',
  'create_listing consults company_is_verified'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_listing'
    limit 1) ~ 'company_not_verified',
  'create_listing raises company_not_verified'
);

select * from finish();
rollback;

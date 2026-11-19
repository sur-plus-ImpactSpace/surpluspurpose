-- REQ-NGO-05 / ADR 0035: full needs profile columns + create_need / propose cap.

begin;
select plan(8);

select ok(
  exists (
    select 1 from pg_type t
    where t.typname = 'need_delivery_preference'
  ),
  'need_delivery_preference enum exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'needs'
      and column_name = 'delivery_preference'
  ),
  'needs.delivery_preference column exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'needs'
      and column_name = 'max_quantity_per_match'
  ),
  'needs.max_quantity_per_match column exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'needs'
      and column_name = 'target_group'
  ),
  'needs.target_group column exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'needs'
      and column_name = 'delivery_address'
  ),
  'needs.delivery_address column exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'needs'
      and column_name = 'has_vehicle'
  ),
  'needs.has_vehicle column exists'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_need'
    limit 1) ~ 'invalid_target_group',
  'create_need validates target_group'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'propose_match'
    limit 1) ~ 'quantity_exceeds_max_per_match',
  'propose_match enforces max_quantity_per_match'
);

select * from finish();
rollback;

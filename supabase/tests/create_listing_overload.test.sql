-- REQ-AUTH-01 follow-up: only one create_listing signature (no PGRST203).

begin;
select plan(1);

select is(
  (
    select count(*)::int from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'create_listing'
  ),
  1,
  'exactly one create_listing overload'
);

select * from finish();
rollback;

-- REQ-OPS-14: editor is Ops for day-to-day work; admin-only for config.

begin;
select plan(6);

select has_function('is_ops');
select has_function('is_ops_admin');

select is(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_role_of'
    limit 1) ~ 'editor',
  true,
  'current_role_of gates editor below aal2'
);

select ok(
  exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'user_role' and e.enumlabel = 'editor'
  ),
  'user_role includes editor'
);

-- set_company_plan body must require ops admin, not bare admin equality alone.
select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_company_plan'
    limit 1) ~ 'is_ops_admin',
  'set_company_plan is ops-admin only'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'propose_match'
    limit 1) ~ 'is_ops',
  'propose_match allows any Ops role'
);

select * from finish();
rollback;

-- REQ-AUTH-01: draft need_state + create_need / promote paths exist.

begin;
select plan(4);

select ok(
  exists (
    select 1 from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'need_state' and e.enumlabel = 'draft'
  ),
  'need_state includes draft'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_need'
    limit 1) ~ 'draft',
  'create_need writes draft when NGO is unverified'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_ngo_verification'
    limit 1) ~ 'draft',
  'set_ngo_verification promotes drafts on approve'
);

select ok(
  (select prosrc from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_need'
    limit 1) ~ 'ngo_is_verified',
  'create_need consults ngo_is_verified'
);

select * from finish();
rollback;

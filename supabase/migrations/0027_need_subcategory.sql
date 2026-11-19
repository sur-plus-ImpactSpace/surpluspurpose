-- 0027 — give a need a subcategory, the way a listing already has one.
--
-- Since the catalog became two-level (apps/web/app/lib/catalog.ts, 2026-08), a
-- listing carries both a category id and a subcategory id so matching is
-- precise. Needs only carried the category. This adds the same subcategory
-- column to needs and threads one optional parameter through create_need — the
-- need form now makes it required, but the column stays nullable so the rows
-- posted before this migration remain valid.

-- Nullable on purpose: legacy needs have no subcategory and must stay valid.
alter table needs add column subcategory text;

-- create_need is copied verbatim from 0003 — same actor guards, same
-- validation order, same error reasons, same ngo derivation, same audit action.
-- The only change is one extra parameter, p_subcategory, written into the new
-- column with the same nullif(trim(...)) treatment a listing's subcategory gets.
create or replace function create_need(
  p_title text,
  p_category text,
  p_quantity int,
  p_city text,
  p_country text,
  p_target_date date default null,
  p_beneficiaries int default null,
  p_story text default null,
  p_subcategory text default null,
  p_ngo_id uuid default null
) returns needs
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_ngo_id uuid;
  created needs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'ngo' and actor_role <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  v_ngo_id := case when actor_role = 'ngo' then current_ngo() else p_ngo_id end;
  if v_ngo_id is null or not exists (select 1 from ngos where id = v_ngo_id) then
    raise exception 'ngo_required';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception 'invalid_title'; end if;
  if coalesce(trim(p_category), '') = '' then raise exception 'invalid_category'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if coalesce(trim(p_city), '') = '' or coalesce(trim(p_country), '') = '' then
    raise exception 'invalid_location';
  end if;
  if p_beneficiaries is not null and p_beneficiaries < 0 then
    raise exception 'invalid_beneficiaries';
  end if;

  insert into needs (
    ngo_id, title, category, subcategory, quantity, city, country, target_date,
    beneficiaries, state, story
  ) values (
    v_ngo_id,
    trim(p_title),
    trim(p_category),
    nullif(trim(p_subcategory), ''),
    p_quantity,
    trim(p_city),
    trim(p_country),
    p_target_date,
    coalesce(p_beneficiaries, 0),
    'open',
    coalesce(trim(coalesce(p_story, '')), '')
  ) returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'need.created', created.id::text, 'customer_visible');

  return created;
end;
$$;

-- Adding p_subcategory changes the argument list, so `create or replace` above
-- created a *second* overload rather than replacing 0003's function. Drop the
-- old 9-argument version so exactly one create_need exists (no overload
-- ambiguity, no dead function that silently ignores the subcategory).
drop function if exists create_need(text, text, int, text, text, date, int, text, uuid);

-- Lock the new signature down like every other authenticated-only RPC: a freshly
-- created function is executable by PUBLIC by default, so revoke that first.
revoke all on function create_need(text, text, int, text, text, date, int, text, text, uuid) from public;
revoke all on function create_need(text, text, int, text, text, date, int, text, text, uuid) from anon;
grant execute on function create_need(text, text, int, text, text, date, int, text, text, uuid) to authenticated;

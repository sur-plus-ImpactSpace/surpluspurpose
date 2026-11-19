-- 0054 — Editable CO2 table (ADR 0028 D6).
--
-- The CO2 saved is not free input and not baked into each match: it comes from
-- one maintained factor per goods category (kg CO2e avoided per kg of goods),
-- edited by Ops only. Impact reports compute from the CURRENT table. A category
-- without a factor yet falls back to the value stored on the match, so existing
-- figures do not drop to zero before Ops has filled the table.
--
-- Every change is audited with the old and the new value. Documents already
-- issued keep the figure they were issued with (they read the match, not the table).

create table if not exists co2_factors (
  category text primary key check (char_length(category) between 1 and 120),
  kg_co2e_per_kg numeric(10, 3) not null check (kg_co2e_per_kg >= 0 and kg_co2e_per_kg <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references users (id) on delete set null
);

alter table co2_factors enable row level security;
revoke all on co2_factors from anon, authenticated;
grant select on co2_factors to authenticated;

drop policy if exists co2_factors_read on co2_factors;
create policy co2_factors_read on co2_factors for select to authenticated using (true);

create or replace function set_co2_factor(p_category text, p_kg_co2e_per_kg numeric) returns co2_factors
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_old numeric;
  f co2_factors%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if current_role_of() is null then
    raise exception 'actor_not_available';
  end if;
  if current_role_of() <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;
  if coalesce(trim(p_category), '') = '' or char_length(p_category) > 120 then
    raise exception 'invalid_category';
  end if;
  if p_kg_co2e_per_kg is null or p_kg_co2e_per_kg < 0 or p_kg_co2e_per_kg > 1000 then
    raise exception 'invalid_factor';
  end if;

  select kg_co2e_per_kg into v_old from co2_factors where category = trim(p_category) for update;

  insert into co2_factors (category, kg_co2e_per_kg, updated_by)
  values (trim(p_category), p_kg_co2e_per_kg, auth.uid())
  on conflict (category) do update
    set kg_co2e_per_kg = excluded.kg_co2e_per_kg, updated_at = now(), updated_by = auth.uid()
  returning * into f;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text,
          'co2_factor.set:' || coalesce(v_old::text, 'none') || '->' || f.kg_co2e_per_kg::text,
          f.category, 'admin_only');

  return f;
end;
$$;

revoke all on function set_co2_factor(text, numeric) from public, anon;
grant execute on function set_co2_factor(text, numeric) to authenticated;

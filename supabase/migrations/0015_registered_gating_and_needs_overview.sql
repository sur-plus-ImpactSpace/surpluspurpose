-- 0015 — wire the 'registered' plan state and give it the anonymised floor
-- the landing page FAQ promises:
--
--   "Initial registration shows you anonymised NGO profiles - category, region
--    and count (e.g. '20 NGOs in Education across Europe'). Names, contacts and
--    direct matching are unlocked with Seed or Tree."
--
-- Note what already holds: needs_visible and ngos_corporate_after_match both
-- require an existing match, so a registered corporate already sees no needs
-- and no NGO names. The gap was never that names leak — it is that (a) the
-- unpaid state did not exist and every company defaulted to paid-tier 'seed',
-- and (b) there was no aggregate floor to show instead of an empty screen.

-- 1. Entitlements ------------------------------------------------------------

alter table plan_entitlements
  add column if not exists ngo_visibility text not null default 'full'
    check (ngo_visibility in ('aggregate', 'full'));

-- Existing paid tiers keep full visibility; make it explicit rather than
-- relying on the column default for rows written before this migration.
update plan_entitlements set ngo_visibility = 'full' where plan in ('seed', 'tree');

insert into plan_entitlements
  (plan, platform_access, matches_per_year, user_seats, support_level, csrd_level,
   green_procurement_cert, social_media_cards, employer_branding, matching_mode,
   ngo_visibility)
values
  -- platform_access stays true: a registered corporate can log in. What they
  -- cannot do is match or see identities — that is matches_per_year 0 and
  -- ngo_visibility 'aggregate'.
  ('registered', true, 0, 1, 'none', 'none', false, false, false, 'none', 'aggregate')
on conflict (plan) do nothing;

-- 2. Stop provisioning unpaid corporates onto a paid tier ---------------------
-- Default only. Existing rows are deliberately NOT backfilled: 'plan' is the
-- only record of who is paying (no Stripe state yet), so rewriting it would
-- silently downgrade real customers. Ops sets the tier on payment.

alter table companies alter column plan set default 'registered';

-- 3. The anonymised aggregate ------------------------------------------------
-- An RPC, not a view. Three reasons:
--   * The promise is an aggregate. A row-returning view hands out cardinality
--     and per-row attributes; over time a client fingerprints individual NGOs
--     and correlates them with the partner names published on the landing page.
--   * A view without security_invoker runs as its OWNER, i.e. it bypasses the
--     caller's RLS. One wrong column is a full leak with no policy to catch it.
--     A definer function with an explicit return type is auditable in one place.
--   * It matches the pattern already set by set_ngo_verification (0013).
--
-- k-anonymity: a bucket of one is not anonymous. "1 NGO · Education · Germany"
-- plus the public partner list identifies an organisation — the exact opposite
-- of the promise. Buckets below k keep their count but lose the country
-- (folding into "across Europe", which is literally the LP's own example);
-- a category that cannot reach k even Europe-wide is dropped entirely.

create or replace function ngo_needs_overview(k_min int default 3)
  returns table (category text, country text, ngo_count int)
  language sql
  stable
  security definer
  set search_path = public
  as $$
    with base as (
      select
        n.category,
        coalesce(n.country, g.country) as country,
        g.id as ngo_id
      from needs n
      join ngos g on g.id = n.ngo_id
      where n.state = 'open'
        -- "verified NGO network" — counting unverified registrations would
        -- inflate the number the corporate is being sold on.
        and g.verification_state = 'verified'
        and (current_role_of() in ('corporate', 'admin'))
    ),
    per_country as (
      select b.category, b.country, count(distinct b.ngo_id) as c
      from base b
      group by b.category, b.country
    ),
    resolved as (
      select
        b.category,
        case when pc.c >= greatest(k_min, 1) then b.country else null end as country,
        b.ngo_id
      from base b
      join per_country pc
        on pc.category = b.category
       and pc.country is not distinct from b.country
    )
    select r.category, r.country, count(distinct r.ngo_id)::int as ngo_count
    from resolved r
    group by r.category, r.country
    having count(distinct r.ngo_id) >= greatest(k_min, 1)
    order by r.category, r.country nulls last;
  $$;

comment on function ngo_needs_overview(int) is
  'Anonymised NGO demand for registered (unpaid) corporates: category, country, count. Never returns names, contacts or ids. Buckets below k_min lose their country; categories below k_min Europe-wide are omitted.';

-- `revoke from public` alone is not enough here. Supabase's default privileges
-- grant EXECUTE on new functions in the public schema to anon and authenticated
-- explicitly, and revoking from the PUBLIC pseudo-role does not touch an
-- explicit grant. Verified on staging: after the first apply, anon still held
-- EXECUTE. The definer guard below would have made an anon call return an empty
-- set anyway (auth.uid() is null, so current_role_of() is null), but the grant
-- should say what we mean.
revoke all on function ngo_needs_overview(int) from public;
revoke all on function ngo_needs_overview(int) from anon;
grant execute on function ngo_needs_overview(int) to authenticated;

-- 4. Remove the loaded gun ---------------------------------------------------
-- ngo_public_min (0001) is the row-level trap described above: a stable id plus
-- focus and country per NGO. It was never granted to anyone, so this is not a
-- live leak — but it is exactly the shape someone would reach for next.

drop view if exists ngo_public_min;

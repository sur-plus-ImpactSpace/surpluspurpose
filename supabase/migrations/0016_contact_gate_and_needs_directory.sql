-- 0016 — gate contacts and matching, not names.
--
-- 0015 was built against the FAQ's claim that "Names, contacts and direct
-- matching are unlocked with Seed or Tree". The landing page disproves the
-- first third of that on the same page: the Matching Engine publishes all ten
-- open needs next to the NGO that posted them — "Tablets for education ->
-- Kick ins Leben", "Laptops -> Labdoo" — publicly, with no account.
--
-- Founder decision (2026-07-16): the names stay public. So the gate is what
-- was actually behind it all along, and what the landing page does NOT give
-- away: contact details and direct matching. Browse free, act paid.
--
-- Consequences for 0015, undone here:
--   * ngo_needs_overview() and its k-anonymity are moot. k-anonymity protects
--     an identity; this one is published on purpose. Keeping it would leave a
--     second, weaker view of the same data with no consumer — and it showed a
--     logged-in corporate LESS than an anonymous visitor sees, which made
--     signing in a downgrade.
--   * ngo_visibility named the wrong thing. Replaced by ngo_contact_access.
--
-- What stays gated, and is genuinely not public:
--   contact_email, contact_phone, board_contact, address (ngos_corporate_after_match)
--   matching                                             (matches_per_year = 0)
--   CSRD documentation                                   (csrd_level = 'none')

-- 1. Name the gate after what it gates ---------------------------------------

alter table plan_entitlements
  add column if not exists ngo_contact_access boolean not null default true;

update plan_entitlements set ngo_contact_access = (plan <> 'registered');

alter table plan_entitlements drop column if exists ngo_visibility;

-- 2. The directory a registered corporate may browse -------------------------
-- Deliberately mirrors what the landing page already shows, so signing in is
-- never a downgrade: the need, and who posted it. Never a way to reach them.
--
-- Still an RPC rather than relaxing needs_visible: that policy is the trust
-- boundary for a *match*, and widening it would also widen every join that
-- hangs off needs. An explicit column list is the whole point — adding a
-- contact column here has to be a deliberate act, not an accident of `select *`.

create or replace function open_needs_directory()
  returns table (
    need_id uuid,
    title text,
    category text,
    quantity int,
    country text,
    ngo_name text,
    ngo_city text,
    ngo_country text,
    ngo_focus text
  )
  language sql
  stable
  security definer
  set search_path = public
  as $$
    select
      n.id,
      n.title,
      n.category,
      n.quantity,
      n.country,
      g.name,
      g.city,
      g.country,
      g.focus
    from needs n
    join ngos g on g.id = n.ngo_id
    where n.state = 'open'
      -- "verified NGO network" is the product claim; an unverified applicant
      -- is not part of what a corporate is being shown.
      and g.verification_state = 'verified'
      and current_role_of() in ('corporate', 'admin')
    order by n.created_at desc;
  $$;

comment on function open_needs_directory() is
  'Open needs plus the posting NGO name/city/country/focus, for any authenticated corporate. Never returns contact_email, contact_phone, board_contact or address — those stay behind ngos_corporate_after_match and a paid plan.';

-- Supabase default privileges grant EXECUTE on new public-schema functions to
-- anon explicitly, and revoking the PUBLIC pseudo-role does not touch that.
-- Verified on staging with 0015. Revoke anon by name.
revoke all on function open_needs_directory() from public;
revoke all on function open_needs_directory() from anon;
grant execute on function open_needs_directory() to authenticated;

-- 3. Remove the aggregate ----------------------------------------------------

drop function if exists ngo_needs_overview(int);

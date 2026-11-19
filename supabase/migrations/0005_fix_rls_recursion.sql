-- 0005_fix_rls_recursion.sql
--
-- Fixes Postgres error 42P17 "infinite recursion detected in policy for
-- relation matches" that made the entire authenticated workspace crash on
-- first load (loadRepositoryDataFromSupabaseRest reads matches/ngos/listings/
-- needs/messages/documents; any of those threw 500 -> the whole render failed).
--
-- Root cause: the SELECT policies cross-referenced each other's RLS-protected
-- tables inline. Reading `matches` evaluated `matches_visible`, which subqueried
-- `listings`; `listings_visible` subqueried `matches`; `needs_visible` subqueried
-- `matches` too -> an unbounded policy evaluation cycle.
--
-- Fix: every cross-table visibility check now runs inside a SECURITY DEFINER
-- function owned by the table owner (RLS is enabled but NOT forced, so the owner
-- bypasses it). No policy reads another RLS-protected table directly, so the
-- cycle is broken. Semantics are unchanged from 0001.

-- 1. Existing match/document helpers: make them SECURITY DEFINER so their
--    internal reads of matches/listings/needs/documents bypass RLS. This also
--    removes the same recursion from the RPC write paths that already call them.
create or replace function can_access_match(p_match_id text) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where m.id::text = p_match_id
        and (
          current_role_of() = 'admin'
          or l.company_id = current_company()
          or n.ngo_id = current_ngo()
        )
    )
  $$;

create or replace function can_access_document(p_document_id text) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select exists (
      select 1
      from documents d
      where d.id::text = p_document_id
        and (
          current_role_of() = 'admin'
          or d.company_id = current_company()
          or d.ngo_id = current_ngo()
          or (d.match_id is not null and can_access_match(d.match_id::text))
        )
    )
  $$;

-- 2. New SECURITY DEFINER helpers for the corporate/ngo cross-match checks.
create or replace function listing_matched_to_ngo(p_listing uuid, p_ngo uuid) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select p_ngo is not null and exists (
      select 1
      from matches m
      join needs n on n.id = m.need_id
      where m.listing_id = p_listing
        and n.ngo_id = p_ngo
    )
  $$;

create or replace function need_matched_to_company(p_need uuid, p_company uuid) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select p_company is not null and exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      where m.need_id = p_need
        and l.company_id = p_company
    )
  $$;

create or replace function ngo_unlocked_for_company(p_ngo uuid, p_company uuid) returns boolean
  language sql stable
  security definer
  set search_path = public
  as $$
    select p_company is not null and exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where n.ngo_id = p_ngo
        and l.company_id = p_company
        and match_unlocks_contact(m)
    )
  $$;

grant execute on function can_access_match(text) to anon, authenticated;
grant execute on function can_access_document(text) to anon, authenticated;
grant execute on function listing_matched_to_ngo(uuid, uuid) to anon, authenticated;
grant execute on function need_matched_to_company(uuid, uuid) to anon, authenticated;
grant execute on function ngo_unlocked_for_company(uuid, uuid) to anon, authenticated;

-- 3. Recreate the recursive SELECT/INSERT policies to call the helpers instead
--    of inlining cross-table subqueries. Behaviour is identical to 0001.
drop policy if exists matches_visible on matches;
create policy matches_visible on matches for select
  using (
    current_role_of() = 'admin'
    or can_access_match(matches.id::text)
  );

drop policy if exists listings_visible on listings;
create policy listings_visible on listings for select
  using (
    current_role_of() = 'admin'
    or company_id = current_company()
    or listing_matched_to_ngo(listings.id, current_ngo())
  );

drop policy if exists needs_visible on needs;
create policy needs_visible on needs for select
  using (
    current_role_of() = 'admin'
    or ngo_id = current_ngo()
    or need_matched_to_company(needs.id, current_company())
  );

drop policy if exists ngos_corporate_after_match on ngos;
create policy ngos_corporate_after_match on ngos for select
  using (
    current_role_of() = 'corporate'
    and ngo_unlocked_for_company(ngos.id, current_company())
  );

drop policy if exists messages_visible on messages;
create policy messages_visible on messages for select
  using (
    current_role_of() = 'admin'
    or (
      visibility = 'customer_visible'
      and can_access_match(messages.match_id::text)
    )
  );

drop policy if exists messages_insert_match_participant on messages;
create policy messages_insert_match_participant on messages for insert
  with check (
    author_id = auth.uid()
    and (
      current_role_of() = 'admin'
      or (
        visibility = 'customer_visible'
        and can_access_match(messages.match_id::text)
      )
    )
  );

drop policy if exists donation_certificates_visible on donation_certificates;
create policy donation_certificates_visible on donation_certificates for select
  using (
    current_role_of() = 'admin'
    or can_access_match(donation_certificates.match_id::text)
  );

drop policy if exists documents_visible on documents;
create policy documents_visible on documents for select
  using (
    current_role_of() = 'admin'
    or company_id = current_company()
    or ngo_id = current_ngo()
    or (match_id is not null and can_access_match(documents.match_id::text))
  );

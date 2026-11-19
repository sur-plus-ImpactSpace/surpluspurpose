-- 0006_listing_photos_storage.sql — D1: photo upload for corporate surplus.
--
-- A public Storage bucket for listing photos, owner-folder RLS on the objects,
-- and an ownership-checked RPC that appends an uploaded photo URL to
-- listings.photos. Path convention: `{auth.uid()}/{listingId}/{filename}` — so
-- a user can only write inside their own folder, and the RPC additionally
-- verifies the listing belongs to their company before recording the URL.
--
-- Surplus photos are low-sensitivity (item pictures), so the bucket is public
-- for simple display via public URLs. Sensitive delivery/handover evidence is a
-- later, private slice.

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Uploads: authenticated users may write only inside their own uid folder.
drop policy if exists "listing_photos_insert_own" on storage.objects;
create policy "listing_photos_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing_photos_update_own" on storage.objects;
create policy "listing_photos_update_own" on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "listing_photos_delete_own" on storage.objects;
create policy "listing_photos_delete_own" on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reads: the bucket is public, so display uses public URLs; this policy keeps
-- the authenticated Storage API (list/metadata) working for the bucket.
drop policy if exists "listing_photos_select" on storage.objects;
create policy "listing_photos_select" on storage.objects for select
  using (bucket_id = 'listing-photos');

-- Record an uploaded photo URL on a listing the caller's company owns.
create or replace function add_listing_photo(p_listing_id uuid, p_url text) returns listings
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  l listings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if coalesce(trim(p_url), '') = '' then
    raise exception 'url_required';
  end if;

  select * into l from listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found';
  end if;
  if l.company_id is distinct from current_company() then
    raise exception 'actor_not_allowed';
  end if;

  update listings
    set photos = photos || to_jsonb(p_url)
    where id = p_listing_id
    returning * into l;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'listing.photo_added', p_listing_id::text, 'customer_visible');

  return l;
end;
$$;

grant execute on function add_listing_photo(uuid, text) to authenticated;

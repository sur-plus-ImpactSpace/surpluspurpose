-- 0007_match_evidence_storage.sql — C4: private evidence upload for a match.
--
-- Unlike listing photos (0006, public item pictures), delivery/handover
-- evidence is sensitive, so the bucket is PRIVATE: no public URLs, downloads go
-- through short-lived signed URLs generated server-side after an access check.
--
-- Path convention: `{auth.uid()}/{matchId}/{filename}` — a user may write only
-- inside their own uid folder, and reads are restricted to participants of the
-- match named in the second path segment (via the security-definer
-- can_access_match helper from 0005). The add_match_evidence RPC records the
-- uploaded object as a `documents` row (kind = 'upload') so evidence surfaces in
-- the same Evidence panel as the generated certificate/CSRD note.

insert into storage.buckets (id, name, public)
values ('match-evidence', 'match-evidence', false)
on conflict (id) do nothing;

-- Uploads: authenticated users may write only inside their own uid folder.
drop policy if exists "match_evidence_insert_own" on storage.objects;
create policy "match_evidence_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'match-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "match_evidence_update_own" on storage.objects;
create policy "match_evidence_update_own" on storage.objects for update to authenticated
  using (
    bucket_id = 'match-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "match_evidence_delete_own" on storage.objects;
create policy "match_evidence_delete_own" on storage.objects for delete to authenticated
  using (
    bucket_id = 'match-evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reads: only participants of the match in the object path may list/read.
-- Downloads use signed URLs minted server-side after the route's own access
-- check; this policy is defence-in-depth for the authenticated Storage API.
drop policy if exists "match_evidence_select_participant" on storage.objects;
create policy "match_evidence_select_participant" on storage.objects for select to authenticated
  using (
    bucket_id = 'match-evidence'
    and can_access_match((storage.foldername(name))[2])
  );

-- Record an uploaded evidence object as a documents row on a match the caller
-- participates in. The object itself is written by the client to its own uid
-- folder; this RPC verifies match access and files the metadata + audit trail.
create or replace function add_match_evidence(
  p_match_id uuid,
  p_path text,
  p_title text,
  p_mime text,
  p_size bigint
) returns documents
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  d documents%rowtype;
  v_role user_role;
  v_company uuid;
  v_ngo uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if coalesce(trim(p_path), '') = '' then
    raise exception 'path_required';
  end if;
  if not can_access_match(p_match_id::text) then
    raise exception 'actor_not_allowed';
  end if;

  -- Own the evidence to the uploader's org so it respects doc_owner_single.
  v_role := current_role_of();
  if v_role = 'corporate' then
    v_company := current_company();
  elsif v_role = 'ngo' then
    v_ngo := current_ngo();
  end if;

  insert into documents (
    kind, title, status, company_id, ngo_id, match_id,
    storage_path, mime, size_bytes, created_by, published_at
  )
  values (
    'upload',
    coalesce(nullif(trim(p_title), ''), 'Evidence upload'),
    'approved',
    v_company, v_ngo, p_match_id,
    p_path, nullif(trim(p_mime), ''), p_size, auth.uid(), now()
  )
  returning * into d;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'document.evidence_uploaded', d.id::text, 'customer_visible');

  return d;
end;
$$;

grant execute on function add_match_evidence(uuid, text, text, text, bigint) to authenticated;

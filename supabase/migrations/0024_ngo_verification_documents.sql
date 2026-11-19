-- 0024 — NGO verification documents (REQ-NGO-02, ADR 0027 C4 + ADR 0030).
--
-- An NGO must submit a non-profit / eligibility proof before Ops may approve it.
-- WHICH proof depends on the recipient's org_type (0023):
--   verein / ggmbh / stiftung -> Freistellungsbescheid
--   public_body               -> public-law proof (no Freistellungsbescheid)
--   freier_traeger            -> Träger proof
--
-- The proof kind is DERIVED server-side from org_type (the client cannot claim a
-- weaker kind). Files live in a PRIVATE bucket; downloads go through short-lived
-- signed URLs minted server-side after an access check (same pattern as
-- match-evidence, 0007). Approval is gated on a document being present.

-- 1. Private bucket ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('ngo-verification', 'ngo-verification', false)
on conflict (id) do nothing;

-- Path convention: `{auth.uid()}/{filename}`. A user writes only inside their
-- own uid folder; Ops (admin) may read every object for review.
drop policy if exists "ngo_verification_insert_own" on storage.objects;
create policy "ngo_verification_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'ngo-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ngo_verification_update_own" on storage.objects;
create policy "ngo_verification_update_own" on storage.objects for update to authenticated
  using (
    bucket_id = 'ngo-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "ngo_verification_delete_own" on storage.objects;
create policy "ngo_verification_delete_own" on storage.objects for delete to authenticated
  using (
    bucket_id = 'ngo-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reads: the uploader (own uid folder) or Ops. Defence-in-depth for the
-- authenticated Storage API; route downloads still mint signed URLs after their
-- own access check.
drop policy if exists "ngo_verification_select_own_or_admin" on storage.objects;
create policy "ngo_verification_select_own_or_admin" on storage.objects for select to authenticated
  using (
    bucket_id = 'ngo-verification'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or current_role_of() = 'admin'
    )
  );

-- 2. Proof kind derived from org_type ---------------------------------------

create type ngo_proof_kind as enum (
  'freistellungsbescheid',  -- steuerbegünstigte Körperschaft (verein/ggmbh/stiftung)
  'public_law_proof',       -- juristische Person des öffentlichen Rechts
  'traeger_proof'           -- Einrichtung in freier/kirchlicher Trägerschaft
);

create or replace function required_proof_kind(p_org_type ngo_org_type)
  returns ngo_proof_kind
  language sql
  immutable
as $$
  select case p_org_type
    when 'verein' then 'freistellungsbescheid'
    when 'ggmbh' then 'freistellungsbescheid'
    when 'stiftung' then 'freistellungsbescheid'
    when 'public_body' then 'public_law_proof'
    when 'freier_traeger' then 'traeger_proof'
  end::ngo_proof_kind;
$$;

comment on function required_proof_kind(ngo_org_type) is
  'Maps a recipient org_type to the proof kind its verification requires (ADR 0030).';

-- 3. Documents table --------------------------------------------------------

create table ngo_verification_documents (
  id           uuid primary key default gen_random_uuid(),
  ngo_id       uuid not null references ngos(id) on delete cascade,
  proof_kind   ngo_proof_kind not null,
  title        text,
  storage_path text not null,
  mime         text,
  size_bytes   bigint,
  uploaded_by  uuid references users(id),
  created_at   timestamptz not null default now()
);

create index ngo_verification_documents_ngo_idx
  on ngo_verification_documents (ngo_id, created_at);

alter table ngo_verification_documents enable row level security;

-- The owning NGO reads its own documents; Ops reads all. Nobody writes directly
-- (inserts go through the security-definer RPC below).
drop policy if exists "ngo_verification_docs_select" on ngo_verification_documents;
create policy "ngo_verification_docs_select" on ngo_verification_documents for select to authenticated
  using (
    ngo_id = current_ngo()
    or current_role_of() = 'admin'
  );

-- 4. Upload RPC (proof kind derived, never client-claimed) ------------------

create or replace function add_ngo_verification_document(
  p_path text,
  p_mime text,
  p_size bigint,
  p_title text default null
) returns ngo_verification_documents
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  d ngo_verification_documents%rowtype;
  v_ngo uuid;
  v_org_type ngo_org_type;
  v_kind ngo_proof_kind;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if current_role_of() <> 'ngo' then
    raise exception 'actor_not_allowed';
  end if;
  v_ngo := current_ngo();
  if v_ngo is null then
    raise exception 'actor_not_allowed';
  end if;
  if coalesce(trim(p_path), '') = '' then
    raise exception 'path_required';
  end if;
  -- The object must sit in the caller's own uid folder (matches the storage
  -- insert policy), so a row can never point at someone else's upload.
  if p_path not like auth.uid()::text || '/%' then
    raise exception 'path_not_owned';
  end if;

  select org_type into v_org_type from ngos where id = v_ngo;
  if v_org_type is null then
    raise exception 'org_type_required';
  end if;
  v_kind := required_proof_kind(v_org_type);

  insert into ngo_verification_documents (
    ngo_id, proof_kind, title, storage_path, mime, size_bytes, uploaded_by
  )
  values (
    v_ngo, v_kind, nullif(trim(p_title), ''), p_path,
    nullif(trim(p_mime), ''), p_size, auth.uid()
  )
  returning * into d;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'ngo.verification_document_uploaded', d.id::text, 'admin_only');

  return d;
end;
$$;

revoke all on function add_ngo_verification_document(text, text, bigint, text) from public;
revoke all on function add_ngo_verification_document(text, text, bigint, text) from anon;
grant execute on function add_ngo_verification_document(text, text, bigint, text) to authenticated;

-- 5. Gate approval on a document being present ------------------------------
-- REQ-NGO-02 / ADR 0027 C4: Ops may not approve an NGO that has not submitted a
-- proof. Only 'approve' is gated; request_info / start_review / reject stay open
-- (Ops must be able to move an NGO through the queue without a document).

create or replace function set_ngo_verification(
  p_ngo_id uuid,
  p_action text
) returns ngos
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  n ngos%rowtype;
  v_target ngo_verification;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  v_target := case p_action
    when 'approve' then 'verified'
    when 'request_info' then 'pending_info'
    when 'reject' then 'rejected'
    when 'start_review' then 'review'
    else null
  end::ngo_verification;

  if v_target is null then
    raise exception 'invalid_action';
  end if;

  select * into n from ngos where id = p_ngo_id for update;
  if not found then
    raise exception 'ngo_not_found';
  end if;

  -- A proof must exist before an NGO can be verified. Never fully automatic:
  -- Ops still reviews the document, this only prevents approving without one.
  if p_action = 'approve'
     and not exists (select 1 from ngo_verification_documents where ngo_id = n.id) then
    raise exception 'verification_document_required';
  end if;

  update ngos
    set verification_state = v_target,
        verified_at = case when v_target = 'verified' then now()::date else null end
    where id = n.id
    returning * into n;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'ngo.' || p_action, n.id::text, 'admin_only');

  return n;
end;
$$;

revoke all on function set_ngo_verification(uuid, text) from public;
grant execute on function set_ngo_verification(uuid, text) to authenticated;

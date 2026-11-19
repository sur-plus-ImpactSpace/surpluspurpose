-- 0025 — Corporate verification (mirror of NGO verification, ADR 0027 C1).
--
-- Until now a corporate self-registered straight onto plan 'registered' with no
-- proof it is a real company — the trust gap ADR 0027 flags. This adds the same
-- shape we built for NGOs: a verification state machine, a private document
-- bucket, a documents table, an upload RPC and an Ops decision RPC gated on a
-- document being present. Simpler than the NGO side: a company has ONE proof
-- kind (a commercial-register extract / business proof), so there is no
-- org_type-derived proof kind here.
--
-- Note: `companies.status` (org_status) is the lifecycle flag (active/suspended);
-- `verification_state` is the trust flag and is independent of it.

create type company_verification as enum (
  'onboarding',
  'verification_pending',
  'pending_info',
  'review',
  'verified',
  'rejected'
);

alter table companies
  add column if not exists verification_state company_verification not null default 'onboarding',
  add column if not exists verified_at date;

comment on column companies.verification_state is
  'Trust state of the corporate (ADR 0027 C1). Independent of status/plan; a '
  'company is verified by Ops after reviewing its business proof.';

-- 1. Private bucket ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('company-verification', 'company-verification', false)
on conflict (id) do nothing;

-- Path convention: `{auth.uid()}/{filename}`. Own-folder write; own or Ops read.
drop policy if exists "company_verification_insert_own" on storage.objects;
create policy "company_verification_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "company_verification_update_own" on storage.objects;
create policy "company_verification_update_own" on storage.objects for update to authenticated
  using (
    bucket_id = 'company-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "company_verification_delete_own" on storage.objects;
create policy "company_verification_delete_own" on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "company_verification_select_own_or_admin" on storage.objects;
create policy "company_verification_select_own_or_admin" on storage.objects for select to authenticated
  using (
    bucket_id = 'company-verification'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or current_role_of() = 'admin'
    )
  );

-- 2. Documents table --------------------------------------------------------

create table company_verification_documents (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references companies(id) on delete cascade,
  title        text,
  storage_path text not null,
  mime         text,
  size_bytes   bigint,
  uploaded_by  uuid references users(id),
  created_at   timestamptz not null default now()
);

create index company_verification_documents_company_idx
  on company_verification_documents (company_id, created_at);

alter table company_verification_documents enable row level security;

drop policy if exists "company_verification_docs_select" on company_verification_documents;
create policy "company_verification_docs_select" on company_verification_documents for select to authenticated
  using (
    company_id = current_company()
    or current_role_of() = 'admin'
  );

-- 3. Upload RPC -------------------------------------------------------------

create or replace function add_company_verification_document(
  p_path text,
  p_mime text,
  p_size bigint,
  p_title text default null
) returns company_verification_documents
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  d company_verification_documents%rowtype;
  v_company uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if current_role_of() <> 'corporate' then
    raise exception 'actor_not_allowed';
  end if;
  v_company := current_company();
  if v_company is null then
    raise exception 'actor_not_allowed';
  end if;
  if coalesce(trim(p_path), '') = '' then
    raise exception 'path_required';
  end if;
  if p_path not like auth.uid()::text || '/%' then
    raise exception 'path_not_owned';
  end if;

  insert into company_verification_documents (
    company_id, title, storage_path, mime, size_bytes, uploaded_by
  )
  values (
    v_company, nullif(trim(p_title), ''), p_path,
    nullif(trim(p_mime), ''), p_size, auth.uid()
  )
  returning * into d;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'company.verification_document_uploaded', d.id::text, 'admin_only');

  return d;
end;
$$;

revoke all on function add_company_verification_document(text, text, bigint, text) from public;
revoke all on function add_company_verification_document(text, text, bigint, text) from anon;
grant execute on function add_company_verification_document(text, text, bigint, text) to authenticated;

-- 4. Ops decision RPC, gated on a document being present --------------------

create or replace function set_company_verification(
  p_company_id uuid,
  p_action text
) returns companies
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  c companies%rowtype;
  v_target company_verification;
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
  end::company_verification;

  if v_target is null then
    raise exception 'invalid_action';
  end if;

  select * into c from companies where id = p_company_id for update;
  if not found then
    raise exception 'company_not_found';
  end if;

  -- A business proof must exist before a corporate can be verified. Never fully
  -- automatic: Ops still reviews the document, this only blocks a blind approve.
  if p_action = 'approve'
     and not exists (select 1 from company_verification_documents where company_id = c.id) then
    raise exception 'verification_document_required';
  end if;

  update companies
    set verification_state = v_target,
        verified_at = case when v_target = 'verified' then now()::date else null end
    where id = c.id
    returning * into c;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'company.' || p_action, c.id::text, 'admin_only');

  return c;
end;
$$;

revoke all on function set_company_verification(uuid, text) from public;
grant execute on function set_company_verification(uuid, text) to authenticated;

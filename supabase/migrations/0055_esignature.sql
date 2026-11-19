-- 0055 — E-signature of donation documents through DocuSeal.
--
-- Ops sends a donation certificate for signing by both sides; DocuSeal collects
-- the signatures; the signed copy is stored here. Invariant: signature status
-- changes ONLY through DocuSeal's webhook (apply_docuseal_event, service role) -
-- no user session can mark anything signed.
--
--   * create_signature_envelope   Ops only: records the envelope DocuSeal just
--                                 created, with its two signers.
--   * apply_docuseal_event        service role only: moves the envelope and its
--                                 signers, stores the signed copy's path.
--   * signature_envelopes / envelope_recipients are readable by the parties of
--     the document's match (verified organisations) and by Ops. The recipients
--     table had no row security at all; it has now.
--   * private bucket `signed-documents` holds the signed PDFs.

alter table signature_envelopes
  add column if not exists signed_storage_path text,
  add column if not exists signed_at timestamptz;

insert into storage.buckets (id, name, public) values ('signed-documents', 'signed-documents', false)
on conflict (id) do nothing;

-- One live envelope per document.
create unique index if not exists signature_envelopes_one_live_idx
  on signature_envelopes (document_id) where state not in ('declined', 'voided');

alter table envelope_recipients enable row level security;
revoke all on envelope_recipients from anon;

drop policy if exists envelopes_visible on signature_envelopes;
create policy envelopes_visible on signature_envelopes for select
  using (
    current_role_of() = 'admin'
    or (
      current_org_verified()
      and exists (
        select 1 from documents d
        where d.id = signature_envelopes.document_id
          and (
            d.company_id = current_company()
            or d.ngo_id = current_ngo()
            or (d.match_id is not null and can_access_match(d.match_id::text))
          )
      )
    )
  );

drop policy if exists envelope_recipients_visible on envelope_recipients;
create policy envelope_recipients_visible on envelope_recipients for select
  using (exists (select 1 from signature_envelopes e where e.id = envelope_recipients.envelope_id));

grant select on signature_envelopes, envelope_recipients to authenticated;

create or replace function create_signature_envelope(
  p_document uuid,
  p_external_id text,
  p_subject text,
  p_company_name text,
  p_company_email text,
  p_ngo_name text,
  p_ngo_email text
) returns signature_envelopes
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  d documents%rowtype;
  e signature_envelopes%rowtype;
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
  if coalesce(trim(p_external_id), '') = '' or coalesce(trim(p_company_email), '') = '' or coalesce(trim(p_ngo_email), '') = '' then
    raise exception 'invalid_envelope';
  end if;

  select * into d from documents where id = p_document;
  if not found then
    raise exception 'document_not_found';
  end if;
  if d.kind <> 'certificate' then
    raise exception 'not_signable';
  end if;
  if exists (select 1 from signature_envelopes where document_id = p_document and state not in ('declined', 'voided')) then
    raise exception 'envelope_exists';
  end if;

  insert into signature_envelopes (document_id, provider, external_id, state, subject, created_by)
  values (p_document, 'docuseal', p_external_id, 'sent', left(p_subject, 200), auth.uid())
  returning * into e;

  insert into envelope_recipients (envelope_id, party_name, party_email, role, status, sign_order)
  values (e.id, left(p_company_name, 200), lower(trim(p_company_email)), 'signer', 'pending', 1),
         (e.id, left(p_ngo_name, 200), lower(trim(p_ngo_email)), 'signer', 'pending', 1);

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'document.signature_requested', d.id::text, 'customer_visible');

  return e;
end;
$$;

revoke all on function create_signature_envelope(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function create_signature_envelope(uuid, text, text, text, text, text, text) to authenticated;

-- Signature status changes only here, only from the verified DocuSeal webhook.
-- p_event: viewed | signed | declined | completed | voided. Returns the envelope state.
create or replace function apply_docuseal_event(
  p_external_id text,
  p_event text,
  p_email text default null,
  p_audit_url text default null,
  p_signed_path text default null
) returns envelope_state
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  e signature_envelopes%rowtype;
  v_pending int;
  v_was_completed boolean;
begin
  if p_event not in ('viewed', 'signed', 'declined', 'completed', 'voided') then
    raise exception 'invalid_event';
  end if;

  select * into e from signature_envelopes where provider = 'docuseal' and external_id = p_external_id for update;
  if not found then
    raise exception 'envelope_not_found';
  end if;
  -- Finished envelopes do not move again (webhooks may arrive twice or out of
  -- order). One exception: a completed envelope may still receive its signed copy.
  if e.state in ('declined', 'voided') then
    return e.state;
  end if;
  if e.state = 'completed' and (p_event <> 'completed' or p_signed_path is null) then
    return e.state;
  end if;
  v_was_completed := e.state = 'completed';

  if p_event = 'viewed' and p_email is not null then
    update envelope_recipients set status = 'viewed'
      where envelope_id = e.id and party_email = lower(trim(p_email)) and status = 'pending';
  elsif p_event = 'signed' and p_email is not null then
    update envelope_recipients set status = 'signed', signed_at = coalesce(signed_at, now())
      where envelope_id = e.id and party_email = lower(trim(p_email));
    select count(*) into v_pending from envelope_recipients where envelope_id = e.id and status <> 'signed';
    update signature_envelopes set state = (case when v_pending = 0 then 'completed' else 'partially_signed' end)::envelope_state
      where id = e.id returning * into e;
  elsif p_event = 'declined' then
    if p_email is not null then
      update envelope_recipients set status = 'declined' where envelope_id = e.id and party_email = lower(trim(p_email));
    end if;
    update signature_envelopes set state = 'declined' where id = e.id returning * into e;
  elsif p_event = 'completed' then
    update envelope_recipients set status = 'signed', signed_at = coalesce(signed_at, now()) where envelope_id = e.id;
    update signature_envelopes set state = 'completed' where id = e.id returning * into e;
  elsif p_event = 'voided' then
    update signature_envelopes set state = 'voided' where id = e.id returning * into e;
  end if;

  if e.state = 'completed' then
    update signature_envelopes
      set completed_at = coalesce(completed_at, now()),
          signed_at = coalesce(signed_at, now()),
          audit_url = coalesce(p_audit_url, audit_url),
          signed_storage_path = coalesce(p_signed_path, signed_storage_path)
      where id = e.id returning * into e;
    if not v_was_completed then
      insert into audit_events (actor, action, target, visibility)
      values ('docuseal', 'document.signed', e.document_id::text, 'customer_visible');
    end if;
  elsif e.state = 'declined' then
    insert into audit_events (actor, action, target, visibility)
    values ('docuseal', 'document.signature_declined', e.document_id::text, 'customer_visible');
  end if;

  return e.state;
end;
$$;

revoke all on function apply_docuseal_event(text, text, text, text, text) from public, anon, authenticated;
grant execute on function apply_docuseal_event(text, text, text, text, text) to service_role;

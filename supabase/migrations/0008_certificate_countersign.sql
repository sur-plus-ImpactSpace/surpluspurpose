-- 0008_certificate_countersign.sql — Spendenbescheinigung-Gegenzeichnung + A1.
--
-- Flow: on completion sur.plus generates the donation certificate as a DRAFT
-- (`in_review`) from the agreed surplus data — the "Muster". The NGO then
-- counter-signs it on the platform (confirm_donation_certificate → `published`),
-- which releases it to the corporate for download (documentDownloadHref already
-- gates on approved/published, so an in_review certificate is not downloadable).
-- The CSRD note (report) is unaffected and stays `approved` on completion.
--
-- "Gegenzeichnung" is an on-platform confirmation + audit event, not a wet/
-- DocuSign signature — a Zuwendungsbestätigung may be issued machine-generated
-- without a handwritten signature (§50 EStDV), provided the NGO is authorised.
-- A1: that authorisation data (Freistellungsbescheid, Finanzamt, register no.,
-- signer) is captured on the ngos row so it can be stamped onto the Muster.

-- A1 · NGO authorisation / Echtheitsdaten for a legally complete certificate.
alter table ngos add column if not exists tax_authorization_ref text;   -- Freistellungsbescheid
alter table ngos add column if not exists tax_authorization_date date;
alter table ngos add column if not exists tax_office text;              -- Finanzamt
alter table ngos add column if not exists registry_number text;        -- Vereinsregister-Nr.
alter table ngos add column if not exists authorized_signer text;
alter table ngos add column if not exists authorized_signer_role text;

-- A1 · an NGO maintains its own authorisation data.
create or replace function update_ngo_authorization(
  p_tax_authorization_ref text,
  p_tax_authorization_date date,
  p_tax_office text,
  p_registry_number text,
  p_authorized_signer text,
  p_authorized_signer_role text
) returns ngos
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  r ngos%rowtype;
  v_ngo uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  v_ngo := current_ngo();
  if v_ngo is null then
    raise exception 'actor_not_allowed';
  end if;

  update ngos set
    tax_authorization_ref = nullif(trim(p_tax_authorization_ref), ''),
    tax_authorization_date = p_tax_authorization_date,
    tax_office = nullif(trim(p_tax_office), ''),
    registry_number = nullif(trim(p_registry_number), ''),
    authorized_signer = nullif(trim(p_authorized_signer), ''),
    authorized_signer_role = nullif(trim(p_authorized_signer_role), '')
    where id = v_ngo
    returning * into r;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'ngo.authorization_updated', v_ngo::text, 'admin_only');

  return r;
end;
$$;

grant execute on function update_ngo_authorization(text, date, text, text, text, text) to authenticated;

-- Recreate ensure_completion_documents (0004) so the certificate lands as a
-- countersign-pending draft (`in_review`) while the CSRD note stays `approved`.
create or replace function ensure_completion_documents(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_listing listings%rowtype;
  v_title text;
  spec record;
begin
  select l.* into v_listing
  from listings l
  join matches m on m.listing_id = l.id
  where m.id = p_match_id;

  for spec in
    select * from (values
      ('certificate'::document_kind, 'Donation certificate', 'in_review'::document_status),
      ('report'::document_kind, 'CSRD evidence note', 'approved'::document_status)
    ) as s(kind, label, target_status)
  loop
    v_title := spec.label || ' · ' || coalesce(v_listing.title, p_match_id::text);

    update documents
      set status = case when status = 'published' then status else spec.target_status end,
          published_at = case
            when spec.target_status in ('approved', 'published') then coalesce(published_at, now())
            else published_at
          end
      where match_id = p_match_id and kind = spec.kind;

    if not found then
      insert into documents (kind, title, status, company_id, ngo_id, match_id, published_at)
      values (
        spec.kind, v_title, spec.target_status, v_listing.company_id, null, p_match_id,
        case when spec.target_status in ('approved', 'published') then now() else null end
      );
    end if;
  end loop;
end;
$$;

-- Gegenzeichnung: the NGO on the match confirms the certificate Muster, which
-- publishes it and releases it to the corporate for download.
create or replace function confirm_donation_certificate(p_document_id uuid)
  returns documents
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  d documents%rowtype;
  v_ngo_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select * into d from documents where id = p_document_id for update;
  if not found then
    raise exception 'document_not_found';
  end if;
  if d.kind <> 'certificate' then
    raise exception 'not_a_certificate';
  end if;
  if d.status = 'published' then
    return d;  -- idempotent: already counter-signed
  end if;
  if d.status <> 'in_review' then
    raise exception 'invalid_status';
  end if;

  select n.ngo_id into v_ngo_id
  from matches m
  join needs n on n.id = m.need_id
  where m.id = d.match_id;
  if v_ngo_id is null or v_ngo_id is distinct from current_ngo() then
    raise exception 'actor_not_allowed';
  end if;

  update documents
    set status = 'published', published_at = now()
    where id = p_document_id
    returning * into d;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'document.certificate_confirmed', d.id::text, 'customer_visible');

  return d;
end;
$$;

grant execute on function confirm_donation_certificate(uuid) to authenticated;

revoke all on function ensure_completion_documents(uuid) from public;

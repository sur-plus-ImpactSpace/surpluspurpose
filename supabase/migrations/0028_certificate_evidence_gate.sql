-- 0028_certificate_evidence_gate.sql — Wert-Beleg-Tor für die Gegenzeichnung (ADR 0029).
--
-- Compliance: die NGO darf eine Spendenbescheinigung erst gegenzeichnen
-- (`published`), wenn zum zugehörigen Match mindestens EIN Wert-Beleg vorliegt.
-- Ein Beleg ist ein `documents`-Eintrag mit kind = 'upload' auf demselben Match
-- (so legt add_match_evidence aus 0007 die hochgeladenen Belege ab — der private
-- `match-evidence`-Bucket ist die Datei, der documents-Row die Metadaten).
--
-- Recreate von confirm_donation_certificate (0008), Body identisch bis auf EINE
-- zusätzliche Prüfung: nachdem feststeht, dass das Dokument ein `certificate` in
-- Status `in_review` ist und der Actor die berechtigte NGO ist, aber BEVOR auf
-- `published` gesetzt wird, wird die Beleg-Existenz geprüft → sonst
-- `evidence_required`. Signatur bleibt identisch (1 Parameter), daher ersetzt
-- `create or replace` die bestehende Funktion sauber (keine Überladung); die
-- Grants aus 0008 bleiben unverändert bestehen.
--
-- MVP: die reine Existenz eines Belegs genügt. Eine Ops-Freigabe des Belegs
-- (z. B. geprüfter/approvter Wert-Beleg statt nur hochgeladen) ist eine spätere
-- Verfeinerung dieses Tors.

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

  -- Wert-Beleg-Tor (ADR 0029): mindestens ein Beleg (upload) auf dem Match.
  if not exists (
    select 1 from documents ev
    where ev.match_id = d.match_id
      and ev.kind = 'upload'
  ) then
    raise exception 'evidence_required';
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

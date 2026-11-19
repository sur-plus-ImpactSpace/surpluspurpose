-- 0026 — submitting the eligibility proof advances an NGO from onboarding to
-- verification_pending (REQ-NGO-02 / registration flow).
--
-- The proof is now collected as the final step of registration (right after
-- claim_workspace), not as a later dashboard chore. So the moment the first
-- proof lands we move the NGO out of 'onboarding' into 'verification_pending'
-- (= "proof submitted, waiting for Ops"), which drives the dashboard status
-- banner and the verification stepper. Ops still reviews and approves manually;
-- this only reflects that the applicant has done their part.
--
-- Recreates add_ngo_verification_document (0024) with that single addition.

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

  -- First proof submitted: leave onboarding for the review queue. Only advance
  -- from 'onboarding' so a later re-upload never overrides an Ops decision.
  update ngos
    set verification_state = 'verification_pending'
    where id = v_ngo and verification_state = 'onboarding';

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'ngo.verification_document_uploaded', d.id::text, 'admin_only');

  return d;
end;
$$;

revoke all on function add_ngo_verification_document(text, text, bigint, text) from public;
revoke all on function add_ngo_verification_document(text, text, bigint, text) from anon;
grant execute on function add_ngo_verification_document(text, text, bigint, text) to authenticated;

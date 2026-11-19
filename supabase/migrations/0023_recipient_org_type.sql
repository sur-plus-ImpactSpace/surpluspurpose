-- 0023 — recipient organization type (ADR 0030).
--
-- The recipient side broadens beyond the classic "gemeinnütziger Verein":
-- gGmbH, Stiftung, public bodies (schools, Kitas, municipalities) and
-- free/church-run institutions. These are legally different recipients with
-- DIFFERENT proofs — a public school has no Freistellungsbescheid, it issues
-- donation receipts as a juristische Person des öffentlichen Rechts.
--
-- So we do NOT add a new role: the role stays binary corporate <-> ngo, and the
-- recipient gains an `org_type` classification chosen at registration. It later
-- drives WHICH document the verification flow (REQ-NGO-02) requires.
--
-- App-level rule (enforced in the form AND here, so the RPC is not weaker than
-- the UI): for a self-registering NGO, org_type is required and must be one of
-- the known values. The column stays nullable so pre-existing rows and the
-- invitation path (accept_invitation, unchanged) remain valid.

create type ngo_org_type as enum (
  'verein',          -- Gemeinnütziger Verein (e.V.)
  'ggmbh',           -- Gemeinnützige GmbH / UG (gGmbH/gUG)
  'stiftung',        -- Gemeinnützige Stiftung
  'public_body',     -- Öffentliche Einrichtung / jPöR (Schule, Kita, Gemeinde, Uni)
  'freier_traeger'   -- Einrichtung in freier/kirchlicher Trägerschaft
);

alter table ngos
  add column if not exists org_type ngo_org_type;

comment on column ngos.org_type is
  'Recipient organization type (ADR 0030). Drives the type-specific proof the '
  'verification flow requires (Freistellungsbescheid for verein/ggmbh/stiftung, '
  'public-law proof for public_body, Träger proof for freier_traeger).';

create or replace function claim_workspace(p_org_name text)
  returns users
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_role text;
  v_email text;
  v_org_name text;
  v_company_id uuid;
  v_ngo_id uuid;
  v_meta jsonb;
  v_salutation text;
  v_academic_title text;
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_org_type text;
  created users;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- One workspace per account. Same guard and same error string as
  -- accept_invitation, so the client can treat both paths alike.
  if exists (select 1 from users where id = auth.uid()) then
    raise exception 'user_already_provisioned';
  end if;

  select lower(email), raw_user_meta_data
    into v_email, v_meta
    from auth.users
    where id = auth.uid();

  -- The role comes from the signup metadata the user chose in the register
  -- flow. 'admin' is deliberately not reachable here: Ops accounts are only
  -- ever created by hand or by invitation, never by self-declaration.
  v_role := v_meta ->> 'requested_role';
  if v_role not in ('corporate', 'ngo') then
    raise exception 'no_requested_role';
  end if;

  v_org_name := nullif(trim(coalesce(p_org_name, '')), '');
  if v_org_name is null or length(v_org_name) < 2 or length(v_org_name) > 160 then
    raise exception 'invalid_org_name';
  end if;

  -- Person fields from signup metadata. Validate here too, so a crafted client
  -- cannot skip what the form requires.
  v_salutation := nullif(trim(coalesce(v_meta ->> 'salutation', '')), '');
  v_academic_title := nullif(trim(coalesce(v_meta ->> 'academic_title', '')), '');
  v_first_name := nullif(trim(coalesce(v_meta ->> 'first_name', '')), '');
  v_last_name := nullif(trim(coalesce(v_meta ->> 'last_name', '')), '');

  if v_salutation not in ('herr', 'frau', 'divers') then
    raise exception 'invalid_salutation';
  end if;
  if v_first_name is null or v_last_name is null then
    raise exception 'invalid_name';
  end if;

  -- Compose full_name for the existing display paths (accept_invitation sets it
  -- directly; keep one populated column here too). concat_ws skips nulls, so a
  -- missing academic_title just drops out cleanly.
  v_full_name := nullif(trim(concat_ws(' ', v_academic_title, v_first_name, v_last_name)), '');

  -- Recipient organization type (ADR 0030). Required for NGOs, ignored for
  -- corporates. Validated here so the RPC is not weaker than the form.
  v_org_type := nullif(trim(coalesce(v_meta ->> 'org_type', '')), '');

  if v_role = 'corporate' then
    -- plan is NOT set here: the column default is 'registered' (0015).
    insert into companies (name, contact_email)
    values (v_org_name, v_email)
    returning id into v_company_id;
  else
    if v_org_type is null
       or v_org_type not in ('verein', 'ggmbh', 'stiftung', 'public_body', 'freier_traeger') then
      raise exception 'invalid_org_type';
    end if;
    -- verification_state defaults to 'onboarding' — the NGO enters the Ops
    -- verification queue. Self-registration grants presence, never trust.
    insert into ngos (name, contact_email, org_type)
    values (v_org_name, v_email, v_org_type::ngo_org_type)
    returning id into v_ngo_id;
  end if;

  insert into users (
    id, email, full_name, salutation, academic_title, first_name, last_name,
    role, company_id, ngo_id
  )
  values (
    auth.uid(), v_email, v_full_name, v_salutation, v_academic_title,
    v_first_name, v_last_name, v_role::user_role, v_company_id, v_ngo_id
  )
  returning * into created;

  insert into audit_events (actor, action, target)
  values (
    auth.uid()::text,
    'workspace.claimed',
    coalesce(v_company_id, v_ngo_id)::text
  );

  return created;
end;
$$;

comment on function claim_workspace(text) is
  'Self-service provisioning after e-mail confirmation. Reads requested_role, '
  'salutation, academic_title, first_name, last_name and (for NGOs) org_type from '
  'signup metadata; validates them; composes full_name; corporate -> companies '
  '(plan default registered), ngo -> ngos (verification_state onboarding, org_type '
  'set). Never provisions admin.';

-- Supabase default privileges grant EXECUTE on new public-schema functions to
-- anon explicitly; revoking PUBLIC does not remove that. Same finding as 0015/0019.
revoke all on function claim_workspace(text) from public;
revoke all on function claim_workspace(text) from anon;
grant execute on function claim_workspace(text) to authenticated;

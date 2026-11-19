-- 0031 — Corporate: refuse free-mail addresses (ADR 0027 C4, REQ-AUTH-03).
--
-- A company must register with its own domain; gmail/gmx/web.de & co. are the
-- cheapest way to fake a company account. NGOs stay allowed on free mail (many
-- small associations use it) — they prove eligibility by document instead.
--
-- Enforced in claim_workspace, the only self-service path that creates a
-- companies row. Invitations are issued by Ops or an existing workspace and are
-- not self-declared, so they are out of scope here.

-- Mirror of FREEMAIL_DOMAINS in packages/domain/src/freemail.ts (a domain test
-- keeps the two lists identical).
create or replace function is_freemail_email(p_email text)
  returns boolean
  language sql
  immutable
  set search_path = public
as $$
  select lower(split_part(trim(coalesce(p_email, '')), '@', 2)) = any (array[
    'aol.com',
    'arcor.de',
    'freenet.de',
    'gmail.com',
    'googlemail.com',
    'gmx.at',
    'gmx.ch',
    'gmx.de',
    'gmx.net',
    'gmx.com',
    'hotmail.com',
    'hotmail.de',
    'icloud.com',
    'live.com',
    'live.de',
    'mac.com',
    'mail.com',
    'mail.de',
    'me.com',
    'msn.com',
    'outlook.com',
    'outlook.de',
    'posteo.de',
    'proton.me',
    'protonmail.com',
    't-online.de',
    'web.de',
    'yahoo.com',
    'yahoo.de',
    'yandex.com',
    'zoho.com'
  ]::text[])
$$;

comment on function is_freemail_email(text) is
  'True when the e-mail domain is a known free-mail provider (REQ-AUTH-03). '
  'Mirror of FREEMAIL_DOMAINS in packages/domain/src/freemail.ts.';

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
    -- A company signs up with its own domain (ADR 0027 C4, REQ-AUTH-03).
    -- Checked here, the one place a corporate workspace is self-provisioned,
    -- so a crafted client that skips the form check still cannot get in.
    if is_freemail_email(v_email) then
      raise exception 'freemail_not_allowed';
    end if;
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
  'set). Corporate signups from free-mail domains are refused (0031). Never '
  'provisions admin.';

-- Supabase default privileges grant EXECUTE on new public-schema functions to
-- anon explicitly; revoking PUBLIC does not remove that. Same finding as 0015/0019.
revoke all on function claim_workspace(text) from public;
revoke all on function claim_workspace(text) from anon;
grant execute on function claim_workspace(text) to authenticated;

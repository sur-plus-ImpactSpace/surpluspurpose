-- 0022 — capture the registrant as a person: salutation, academic title,
-- first & last name.
--
-- Until now registration collected a single free-text `full_name` in the signup
-- metadata, and claim_workspace() did not even persist it — a self-provisioned
-- user landed in `users` with a null name. This splits the name into structured
-- columns (so we can address people correctly and filter later) and teaches
-- claim_workspace to read them from the signup metadata, validate them, and
-- compose `full_name` for the existing display paths.
--
-- App-level rules (enforced in the form AND here so the RPC is not weaker than
-- the UI): salutation is required (herr | frau | divers); first_name and
-- last_name are required; academic_title is optional (empty = none). The columns
-- stay nullable so pre-existing rows and the invitation path (accept_invitation,
-- left unchanged) remain valid.

alter table users
  add column if not exists salutation text,
  add column if not exists academic_title text,
  add column if not exists first_name text,
  add column if not exists last_name text;

comment on column users.salutation is
  'Form of address chosen at registration: herr | frau | divers.';
comment on column users.academic_title is
  'Academic title as display text (e.g. Dr., Prof., Prof. Dr.). Empty/null = none.';

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

  if v_role = 'corporate' then
    -- plan is NOT set here: the column default is 'registered' (0015).
    insert into companies (name, contact_email)
    values (v_org_name, v_email)
    returning id into v_company_id;
  else
    -- verification_state defaults to 'onboarding' — the NGO enters the Ops
    -- verification queue. Self-registration grants presence, never trust.
    insert into ngos (name, contact_email)
    values (v_org_name, v_email)
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
  'Self-service provisioning after e-mail confirmation. Reads requested_role, salutation, academic_title, first_name, last_name from signup metadata; validates salutation/names; composes full_name; corporate -> companies (plan default registered), ngo -> ngos (verification_state onboarding). Never provisions admin.';

-- Supabase default privileges grant EXECUTE on new public-schema functions to
-- anon explicitly; revoking PUBLIC does not remove that. Same finding as 0015/0019.
revoke all on function claim_workspace(text) from public;
revoke all on function claim_workspace(text) from anon;
grant execute on function claim_workspace(text) to authenticated;

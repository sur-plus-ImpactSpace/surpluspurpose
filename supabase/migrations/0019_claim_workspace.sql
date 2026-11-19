-- 0019 — close the funnel: self-service workspace provisioning.
--
-- The state before this: registration stored `requested_role` in the signup
-- metadata, and no code anywhere read it. The only provisioning path was
-- accept_invitation (requires an invitation) or Flo running SQL by hand.
-- Every self-registered user landed on "Workspace access pending" and stayed
-- there until manual intervention — a funnel that ends in a human.
--
-- Why this is safe NOW and was not a week ago: companies.plan defaulted to
-- 'seed', a paying tier, so letting people provision themselves would have
-- handed out seed entitlements for free. Since 0014–0016 a self-provisioned
-- corporate lands on 'registered' (browse-only, 0 matches, no contacts), and
-- an NGO lands in verification_state 'onboarding', where 0012's clickwrap
-- gating and 0013's verification queue hold everything until Ops approves.
-- The gates built this week are what make this RPC safe to exist.

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

  select lower(email), raw_user_meta_data ->> 'requested_role'
    into v_email, v_role
    from auth.users
    where id = auth.uid();

  -- The role comes from the signup metadata the user chose in the register
  -- flow. 'admin' is deliberately not reachable here: Ops accounts are only
  -- ever created by hand or by invitation, never by self-declaration.
  if v_role not in ('corporate', 'ngo') then
    raise exception 'no_requested_role';
  end if;

  v_org_name := nullif(trim(coalesce(p_org_name, '')), '');
  if v_org_name is null or length(v_org_name) < 2 or length(v_org_name) > 160 then
    raise exception 'invalid_org_name';
  end if;

  if v_role = 'corporate' then
    -- plan is NOT set here: the column default is 'registered' (0015), and
    -- naming it explicitly would just create a second place to get it wrong.
    insert into companies (name, contact_email)
    values (v_org_name, v_email)
    returning id into v_company_id;
  else
    -- verification_state defaults to 'onboarding' — the NGO enters the same
    -- Ops verification queue as everyone else. Self-registration grants
    -- presence, never trust.
    insert into ngos (name, contact_email)
    values (v_org_name, v_email)
    returning id into v_ngo_id;
  end if;

  insert into users (id, email, role, company_id, ngo_id)
  values (auth.uid(), v_email, v_role::user_role, v_company_id, v_ngo_id)
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
  'Self-service provisioning after e-mail confirmation. Reads requested_role from signup metadata; corporate -> companies (plan default registered), ngo -> ngos (verification_state onboarding). Never provisions admin.';

-- Supabase default privileges grant EXECUTE on new public-schema functions to
-- anon explicitly; revoking PUBLIC does not remove that. Same finding as 0015.
revoke all on function claim_workspace(text) from public;
revoke all on function claim_workspace(text) from anon;
grant execute on function claim_workspace(text) to authenticated;

-- sur.plus E1 initial schema
-- Source contract: 05_Landingpage/Bauplaene/sur.plus_supabase_schema.sql
-- E1 adjustment: platform plans are Seed and Tree only.

create extension if not exists pgcrypto;

create type plan_tier as enum ('seed', 'tree');
create type user_role as enum ('corporate', 'ngo', 'admin');
create type org_status as enum ('onboarding', 'active', 'suspended');
create type ngo_verification as enum ('onboarding', 'verification_pending', 'pending_info', 'review', 'verified', 'rejected');
create type listing_state as enum ('draft', 'open', 'match_pending', 'confirmed', 'completed', 'withdrawn');
create type need_state as enum ('open', 'matched', 'fulfilled', 'closed');
create type match_state as enum ('proposed', 'ngo_confirmed', 'both_confirmed', 'in_transit', 'delivered', 'completed', 'cancelled');
create type certificate_status as enum ('none', 'draft', 'issued', 'final');
create type visibility as enum ('admin_only', 'customer_visible');
create type category_req_state as enum ('submitted', 'admin_review', 'accepted', 'rejected');
create type agent_run_status as enum ('queued', 'needs_approval', 'approved', 'completed', 'rejected');
create type proposed_action_status as enum ('pending', 'approved', 'rejected', 'executed');
create type invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type invitation_delivery_operation as enum ('create', 'resend');
create type invitation_delivery_status as enum ('sent', 'skipped', 'failed');
create type idempotency_status as enum ('processing', 'completed', 'failed');
create type document_kind as enum ('upload', 'marketing_asset', 'social_ad', 'certificate', 'agreement', 'report');
create type document_status as enum ('draft', 'in_review', 'approved', 'published', 'archived');
create type envelope_state as enum ('draft', 'sent', 'partially_signed', 'completed', 'declined', 'voided');
create type recipient_role as enum ('signer', 'approver', 'cc');
create type recipient_status as enum ('pending', 'viewed', 'signed', 'declined');
create type signature_provider as enum ('docuseal', 'documenso', 'manual');

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan plan_tier not null default 'seed',
  city text,
  country text,
  owner_name text,
  contact_email text,
  reporting_email text,
  status org_status not null default 'active',
  created_at timestamptz not null default now()
);

create table ngos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country text,
  focus text,
  verification_state ngo_verification not null default 'onboarding',
  trust_score int not null default 0 check (trust_score between 0 and 100),
  board_contact text,
  contact_email text,
  contact_phone text,
  address text,
  verified_at date,
  created_at timestamptz not null default now()
);

create view ngo_public_min as
  select id, country, verification_state, trust_score, focus
  from ngos;

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null,
  company_id uuid references companies (id),
  ngo_id uuid references ngos (id),
  created_at timestamptz not null default now(),
  constraint role_org_consistent check (
    (role = 'corporate' and company_id is not null and ngo_id is null) or
    (role = 'ngo' and ngo_id is not null and company_id is null) or
    (role = 'admin' and company_id is null and ngo_id is null)
  )
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role user_role not null,
  company_id uuid references companies (id) on delete cascade,
  ngo_id uuid references ngos (id) on delete cascade,
  org_name text,
  status invitation_status not null default 'pending',
  expires_at date,
  acceptance_token_hash text,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint invitation_role_org_consistent check (
    (role = 'corporate' and company_id is not null and ngo_id is null) or
    (role = 'ngo' and ngo_id is not null and company_id is null) or
    (role = 'admin' and company_id is null and ngo_id is null)
  )
);

create table invitation_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references invitations (id) on delete cascade,
  operation invitation_delivery_operation not null,
  provider text not null,
  status invitation_delivery_status not null,
  message_id text,
  error text,
  reason text,
  actor_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invitation_delivery_provider_present check (length(trim(provider)) > 0),
  constraint invitation_delivery_sent_shape check (
    status <> 'sent' or error is null
  )
);

create table idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  actor_id uuid not null references users (id) on delete cascade,
  endpoint_id text not null,
  request_hash text not null,
  status idempotency_status not null default 'processing',
  response_status int,
  response_body jsonb,
  resource_type text,
  resource_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  completed_at timestamptz,
  constraint idempotency_completed_has_response check (
    status <> 'completed' or (response_status is not null and response_body is not null and completed_at is not null)
  )
);

create or replace function reserve_idempotency_key(
  p_key text,
  p_endpoint_id text,
  p_request_hash text
) returns table (
  reservation_state text,
  response_status int,
  response_body jsonb,
  resource_type text,
  resource_id text
)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  existing idempotency_keys%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  insert into idempotency_keys (key, actor_id, endpoint_id, request_hash)
  values (p_key, auth.uid(), p_endpoint_id, p_request_hash)
  on conflict (actor_id, endpoint_id, key) do nothing
  returning * into existing;

  if found then
    return query select 'reserved'::text, null::int, null::jsonb, null::text, null::text;
    return;
  end if;

  select *
  into existing
  from idempotency_keys
  where actor_id = auth.uid()
    and endpoint_id = p_endpoint_id
    and key = p_key
  for update;

  if existing.request_hash <> p_request_hash then
    return query select 'conflict'::text, null::int, null::jsonb, null::text, null::text;
    return;
  end if;

  if existing.status = 'completed' then
    return query select
      'replay'::text,
      existing.response_status,
      existing.response_body,
      existing.resource_type,
      existing.resource_id;
    return;
  end if;

  return query select existing.status::text, null::int, null::jsonb, null::text, null::text;
end;
$$;

create or replace function complete_idempotency_key(
  p_key text,
  p_endpoint_id text,
  p_request_hash text,
  p_response_status int,
  p_response_body jsonb,
  p_resource_type text default null,
  p_resource_id text default null
) returns idempotency_keys
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  completed idempotency_keys%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  update idempotency_keys
  set status = 'completed',
      response_status = p_response_status,
      response_body = p_response_body,
      resource_type = p_resource_type,
      resource_id = p_resource_id,
      completed_at = now()
  where actor_id = auth.uid()
    and endpoint_id = p_endpoint_id
    and key = p_key
    and request_hash = p_request_hash
    and status = 'processing'
  returning * into completed;

  if not found then
    raise exception 'idempotency_key_not_reserved';
  end if;

  return completed;
end;
$$;

create table listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  title text not null,
  category text not null,
  subcategory text,
  quantity int not null check (quantity >= 0),
  unit text not null default 'units',
  unit_value numeric(12,2),
  city text,
  country text,
  condition text,
  state listing_state not null default 'draft',
  available_until date,
  pickup_window text,
  packaging text,
  weight_kg numeric(10,2),
  category_details text,
  photos jsonb not null default '[]',
  attachments jsonb not null default '[]',
  review_flags jsonb not null default '[]',
  eligibility jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table needs (
  id uuid primary key default gen_random_uuid(),
  ngo_id uuid not null references ngos (id) on delete cascade,
  title text not null,
  category text not null,
  quantity int check (quantity >= 0),
  city text,
  country text,
  target_date date,
  beneficiaries int,
  state need_state not null default 'open',
  story text,
  created_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings (id) on delete cascade,
  need_id uuid not null references needs (id) on delete cascade,
  state match_state not null default 'proposed',
  score int check (score between 0 and 100),
  co2_tons numeric(8,2),
  pickup_date date,
  delivery_date date,
  carrier text,
  tracking_ref text,
  created_at timestamptz not null default now(),
  unique (listing_id, need_id)
);

create or replace function match_unlocks_contact(m matches) returns boolean
  language sql immutable as $$
    select m.state in ('both_confirmed', 'in_transit', 'delivered', 'completed')
  $$;

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  author_id uuid references users (id),
  body text not null,
  visibility visibility not null default 'customer_visible',
  created_at timestamptz not null default now()
);

create index messages_match_created_idx on messages (match_id, created_at);

create table donation_certificates (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references matches (id) on delete cascade,
  status certificate_status not null default 'none',
  fair_value numeric(12,2),
  issued_at timestamptz,
  pdf_path text
);

create table category_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  description text,
  quantity int,
  country text,
  urgency text,
  state category_req_state not null default 'submitted',
  risk_flags jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  target text,
  visibility visibility not null default 'admin_only',
  created_at timestamptz not null default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  company_id uuid references companies (id),
  ngo_id uuid references ngos (id),
  task_type text not null,
  title text,
  prompt text,
  status agent_run_status not null default 'queued',
  summary text,
  findings jsonb not null default '[]',
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint agent_run_scope check (not (company_id is not null and ngo_id is not null))
);

create table agent_proposed_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs (id) on delete cascade,
  label text not null,
  description text,
  status proposed_action_status not null default 'pending',
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  target_type text,
  target_id text,
  proposed_payload jsonb not null default '{}',
  requires_human_approval boolean not null default true,
  approved_by uuid references users (id),
  approved_at timestamptz,
  executed_at timestamptz,
  constraint agent_action_human_gate check (requires_human_approval = true),
  constraint agent_action_execution_requires_approval check (
    status <> 'executed' or (approved_by is not null and approved_at is not null)
  )
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  kind document_kind not null,
  title text not null,
  status document_status not null default 'draft',
  company_id uuid references companies (id) on delete cascade,
  ngo_id uuid references ngos (id) on delete cascade,
  match_id uuid references matches (id) on delete set null,
  storage_path text,
  mime text,
  size_bytes bigint,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint doc_owner_single check (not (company_id is not null and ngo_id is not null))
);

create table signature_envelopes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents (id) on delete cascade,
  provider signature_provider not null default 'docuseal',
  external_id text,
  state envelope_state not null default 'draft',
  subject text,
  audit_url text,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table envelope_recipients (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references signature_envelopes (id) on delete cascade,
  party_name text not null,
  party_email text not null,
  role recipient_role not null default 'signer',
  status recipient_status not null default 'pending',
  sign_order int not null default 1,
  signed_at timestamptz
);

alter table agent_runs add column produced_document_id uuid references documents (id);

create index companies_plan_status_idx on companies (plan, status);
create index users_company_role_idx on users (company_id, role);
create index users_ngo_role_idx on users (ngo_id, role);
create index invitations_email_status_idx on invitations (email, status);
create index invitations_company_status_idx on invitations (company_id, status, created_at);
create index invitations_ngo_status_idx on invitations (ngo_id, status, created_at);
create unique index invitations_acceptance_token_hash_idx on invitations (acceptance_token_hash)
  where acceptance_token_hash is not null;
create index invitation_delivery_attempts_invitation_created_idx
  on invitation_delivery_attempts (invitation_id, created_at desc);
create index invitation_delivery_attempts_status_created_idx
  on invitation_delivery_attempts (status, created_at desc);
create unique index idempotency_actor_endpoint_key_idx on idempotency_keys (actor_id, endpoint_id, key);
create index idempotency_expiry_idx on idempotency_keys (expires_at);
create index idempotency_actor_endpoint_created_idx on idempotency_keys (actor_id, endpoint_id, created_at);
create index listings_company_state_idx on listings (company_id, state, created_at);
create index listings_category_state_idx on listings (category, state, created_at);
create index needs_ngo_state_idx on needs (ngo_id, state, created_at);
create index needs_category_state_idx on needs (category, state, created_at);
create index matches_listing_state_idx on matches (listing_id, state, created_at);
create index matches_need_state_idx on matches (need_id, state, created_at);
create index matches_state_created_idx on matches (state, created_at);
create index category_requests_company_state_idx on category_requests (company_id, state, created_at);
create index audit_events_target_created_idx on audit_events (target, created_at);
create index agent_runs_company_status_idx on agent_runs (company_id, status, created_at);
create index agent_runs_ngo_status_idx on agent_runs (ngo_id, status, created_at);
create index agent_actions_run_status_idx on agent_proposed_actions (run_id, status);
create index documents_company_status_idx on documents (company_id, status, created_at);
create index documents_ngo_status_idx on documents (ngo_id, status, created_at);
create index documents_match_kind_idx on documents (match_id, kind, status);
create index signature_envelopes_document_state_idx on signature_envelopes (document_id, state, created_at);
create unique index signature_envelopes_external_id_idx on signature_envelopes (provider, external_id)
  where external_id is not null;
create index envelope_recipients_envelope_status_idx on envelope_recipients (envelope_id, status);

create table plan_entitlements (
  plan plan_tier primary key,
  platform_access boolean not null default true,
  matches_per_year int,
  user_seats int not null,
  support_level text not null,
  csrd_level text not null,
  green_procurement_cert boolean not null default false,
  social_media_cards boolean not null default false,
  employer_branding boolean not null default false,
  matching_mode text not null
);

insert into plan_entitlements
  (plan, platform_access, matches_per_year, user_seats, support_level, csrd_level,
   green_procurement_cert, social_media_cards, employer_branding, matching_mode)
values
  ('seed', true, 12, 2, '48h', 'per_match', false, false, false, 'human'),
  ('tree', true, null, 5, 'priority', 'audit_grade_isae3000', true, true, true, 'curated_priority');

create view company_match_usage as
  select l.company_id,
         date_part('year', m.created_at)::int as year,
         count(*) filter (where m.state in ('both_confirmed', 'in_transit', 'delivered', 'completed')) as matches_committed
  from matches m
  join listings l on l.id = m.listing_id
  group by l.company_id, date_part('year', m.created_at);

alter table companies enable row level security;
alter table ngos enable row level security;
alter table users enable row level security;
alter table invitations enable row level security;
alter table invitation_delivery_attempts enable row level security;
alter table idempotency_keys enable row level security;
alter table listings enable row level security;
alter table needs enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;
alter table donation_certificates enable row level security;
alter table audit_events enable row level security;
alter table agent_runs enable row level security;
alter table agent_proposed_actions enable row level security;
alter table documents enable row level security;
alter table signature_envelopes enable row level security;
alter table plan_entitlements enable row level security;

create or replace function current_role_of() returns user_role
  language sql stable
  security definer
  set search_path = public
  as $$ select role from users where id = auth.uid() $$;

create or replace function current_company() returns uuid
  language sql stable
  security definer
  set search_path = public
  as $$ select company_id from users where id = auth.uid() $$;

create or replace function current_ngo() returns uuid
  language sql stable
  security definer
  set search_path = public
  as $$ select ngo_id from users where id = auth.uid() $$;

create or replace function create_invitation(
  p_email text,
  p_role user_role,
  p_company_id uuid default null,
  p_ngo_id uuid default null,
  p_org_name text default null,
  p_expires_at date default null,
  p_acceptance_token_hash text default null
) returns invitations
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  normalized_email text;
  resolved_company uuid;
  resolved_ngo uuid;
  company_plan plan_tier;
  seat_limit int;
  seats_in_use int;
  normalized_token_hash text;
  created invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  normalized_email := lower(trim(p_email));
  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'invalid_invitation';
  end if;

  normalized_token_hash := nullif(lower(trim(coalesce(p_acceptance_token_hash, ''))), '');
  if normalized_token_hash is not null and normalized_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_invitation';
  end if;

  if p_role = 'admin' then
    raise exception 'invalid_invitation';
  end if;

  if actor_role <> 'admin' and actor_role <> p_role then
    raise exception 'actor_not_allowed';
  end if;

  if p_role = 'corporate' then
    resolved_company := coalesce(p_company_id, current_company());
    if resolved_company is null or p_ngo_id is not null then
      raise exception 'invalid_scope';
    end if;
    if actor_role <> 'admin' and resolved_company <> current_company() then
      raise exception 'actor_not_allowed';
    end if;

    select plan into company_plan from companies where id = resolved_company;
    if company_plan is null then
      raise exception 'company_not_found';
    end if;

    select user_seats into seat_limit from plan_entitlements where plan = company_plan;
    select count(*) into seats_in_use
      from users
      where role = 'corporate' and company_id = resolved_company;
    select seats_in_use + count(*) into seats_in_use
      from invitations
      where status = 'pending' and role = 'corporate' and company_id = resolved_company;

    if seats_in_use >= seat_limit then
      raise exception 'seat_limit_exceeded';
    end if;

    if exists (
      select 1
      from invitations
      where status = 'pending'
        and role = 'corporate'
        and company_id = resolved_company
        and email = normalized_email
    ) then
      raise exception 'pending_invitation_exists';
    end if;

    insert into invitations (email, role, company_id, ngo_id, org_name, expires_at, acceptance_token_hash)
    values (normalized_email, p_role, resolved_company, null, nullif(trim(p_org_name), ''), p_expires_at, normalized_token_hash)
    returning * into created;

    insert into audit_events (actor, action, target, visibility)
    values (auth.uid()::text, 'invitation.created', created.id::text, 'admin_only');

    return created;
  end if;

  resolved_ngo := coalesce(p_ngo_id, current_ngo());
  if resolved_ngo is null or p_company_id is not null then
    raise exception 'invalid_scope';
  end if;
  if actor_role <> 'admin' and resolved_ngo <> current_ngo() then
    raise exception 'actor_not_allowed';
  end if;
  if not exists (select 1 from ngos where id = resolved_ngo) then
    raise exception 'ngo_not_found';
  end if;

  if exists (
    select 1
    from invitations
    where status = 'pending'
      and role = 'ngo'
      and ngo_id = resolved_ngo
      and email = normalized_email
  ) then
    raise exception 'pending_invitation_exists';
  end if;

  insert into invitations (email, role, company_id, ngo_id, org_name, expires_at, acceptance_token_hash)
  values (normalized_email, p_role, null, resolved_ngo, nullif(trim(p_org_name), ''), p_expires_at, normalized_token_hash)
  returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'invitation.created', created.id::text, 'admin_only');

  return created;
end;
$$;

create or replace function accept_invitation(
  p_acceptance_token text,
  p_full_name text default null
) returns users
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  normalized_token text;
  token_hash text;
  invitation invitations%rowtype;
  auth_email text;
  existing users%rowtype;
  created users%rowtype;
  company_plan plan_tier;
  seat_limit int;
  active_corporate_seats int;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  normalized_token := trim(coalesce(p_acceptance_token, ''));
  if length(normalized_token) < 32 then
    raise exception 'invalid_invitation_token';
  end if;

  token_hash := encode(digest(normalized_token, 'sha256'), 'hex');

  select *
  into invitation
  from invitations
  where acceptance_token_hash = token_hash
    and status = 'pending'
  for update;

  if invitation.id is null then
    raise exception 'invalid_invitation_token';
  end if;

  if invitation.expires_at is not null and invitation.expires_at < current_date then
    update invitations
    set status = 'expired'
    where id = invitation.id;
    raise exception 'invitation_expired';
  end if;

  select lower(email)
  into auth_email
  from auth.users
  where id = auth.uid();

  if auth_email is null or auth_email <> lower(invitation.email) then
    raise exception 'invitation_email_mismatch';
  end if;

  select *
  into existing
  from users
  where id = auth.uid();

  if existing.id is not null then
    if existing.role = invitation.role
      and (
        (invitation.role = 'corporate' and existing.company_id = invitation.company_id and existing.ngo_id is null)
        or
        (invitation.role = 'ngo' and existing.ngo_id = invitation.ngo_id and existing.company_id is null)
      ) then
      update invitations
      set status = 'accepted',
          accepted_at = coalesce(accepted_at, now()),
          accepted_by = auth.uid()
      where id = invitation.id;

      return existing;
    end if;

    raise exception 'user_already_provisioned';
  end if;

  if invitation.role = 'corporate' then
    select plan into company_plan from companies where id = invitation.company_id;
    if company_plan is null then
      raise exception 'company_not_found';
    end if;

    select user_seats into seat_limit from plan_entitlements where plan = company_plan;
    select count(*) into active_corporate_seats
      from users
      where role = 'corporate'
        and company_id = invitation.company_id;

    if active_corporate_seats >= seat_limit then
      raise exception 'seat_limit_exceeded';
    end if;
  elsif invitation.role = 'ngo' then
    if not exists (select 1 from ngos where id = invitation.ngo_id) then
      raise exception 'ngo_not_found';
    end if;
  else
    raise exception 'invalid_invitation';
  end if;

  insert into users (id, email, full_name, role, company_id, ngo_id)
  values (
    auth.uid(),
    invitation.email,
    nullif(trim(coalesce(p_full_name, '')), ''),
    invitation.role,
    invitation.company_id,
    invitation.ngo_id
  )
  returning * into created;

  update invitations
  set status = 'accepted',
      accepted_at = now(),
      accepted_by = auth.uid()
  where id = invitation.id;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'invitation.accepted', invitation.id::text, 'admin_only');

  return created;
end;
$$;

create or replace function resend_invitation(
  p_invitation_id uuid,
  p_acceptance_token_hash text
) returns invitations
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  invitation invitations%rowtype;
  normalized_token_hash text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  normalized_token_hash := nullif(lower(trim(coalesce(p_acceptance_token_hash, ''))), '');
  if normalized_token_hash is null or normalized_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_invitation';
  end if;

  select *
  into invitation
  from invitations
  where id = p_invitation_id
  for update;

  if invitation.id is null then
    raise exception 'invitation_not_found';
  end if;

  if actor_role <> 'admin' then
    if actor_role = 'corporate' and (invitation.role <> 'corporate' or invitation.company_id <> current_company()) then
      raise exception 'actor_not_allowed';
    end if;
    if actor_role = 'ngo' and (invitation.role <> 'ngo' or invitation.ngo_id <> current_ngo()) then
      raise exception 'actor_not_allowed';
    end if;
  end if;

  if invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  update invitations
  set acceptance_token_hash = normalized_token_hash
  where id = invitation.id
  returning * into invitation;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'invitation.resent', invitation.id::text, 'admin_only');

  return invitation;
end;
$$;

create or replace function revoke_invitation(
  p_invitation_id uuid
) returns invitations
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  invitation invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  select *
  into invitation
  from invitations
  where id = p_invitation_id
  for update;

  if invitation.id is null then
    raise exception 'invitation_not_found';
  end if;

  if actor_role <> 'admin' then
    if actor_role = 'corporate' and (invitation.role <> 'corporate' or invitation.company_id <> current_company()) then
      raise exception 'actor_not_allowed';
    end if;
    if actor_role = 'ngo' and (invitation.role <> 'ngo' or invitation.ngo_id <> current_ngo()) then
      raise exception 'actor_not_allowed';
    end if;
  end if;

  if invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  update invitations
  set status = 'revoked',
      acceptance_token_hash = null
  where id = invitation.id
  returning * into invitation;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'invitation.revoked', invitation.id::text, 'admin_only');

  return invitation;
end;
$$;

create or replace function record_invitation_delivery_attempt(
  p_invitation_id uuid,
  p_operation invitation_delivery_operation,
  p_provider text,
  p_status invitation_delivery_status,
  p_message_id text default null,
  p_error text default null,
  p_reason text default null
) returns invitation_delivery_attempts
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  invitation invitations%rowtype;
  normalized_provider text;
  created invitation_delivery_attempts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  select *
  into invitation
  from invitations
  where id = p_invitation_id;

  if invitation.id is null then
    raise exception 'invitation_not_found';
  end if;

  if actor_role <> 'admin' then
    if actor_role = 'corporate' and (invitation.role <> 'corporate' or invitation.company_id <> current_company()) then
      raise exception 'actor_not_allowed';
    end if;
    if actor_role = 'ngo' and (invitation.role <> 'ngo' or invitation.ngo_id <> current_ngo()) then
      raise exception 'actor_not_allowed';
    end if;
  end if;

  normalized_provider := left(trim(coalesce(p_provider, '')), 80);
  if normalized_provider = '' then
    raise exception 'invalid_delivery_attempt';
  end if;

  insert into invitation_delivery_attempts (
    invitation_id,
    operation,
    provider,
    status,
    message_id,
    error,
    reason,
    actor_id
  )
  values (
    invitation.id,
    p_operation,
    normalized_provider,
    p_status,
    nullif(left(trim(coalesce(p_message_id, '')), 160), ''),
    nullif(left(trim(coalesce(p_error, '')), 500), ''),
    nullif(left(trim(coalesce(p_reason, '')), 240), ''),
    auth.uid()
  )
  returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'invitation.delivery.' || p_status::text, invitation.id::text, 'admin_only');

  return created;
end;
$$;

create or replace function agent_run_json(r agent_runs) returns jsonb
  language sql stable as $$
    select jsonb_build_object(
      'id', r.id::text,
      'role', r.role,
      'companyId', r.company_id::text,
      'ngoId', r.ngo_id::text,
      'taskType', r.task_type,
      'title', coalesce(r.title, ''),
      'prompt', coalesce(r.prompt, ''),
      'status', r.status,
      'summary', coalesce(r.summary, ''),
      'findings', r.findings,
      'attachments', r.attachments,
      'producedDocumentId', r.produced_document_id::text,
      'createdAt', r.created_at,
      'completedAt', r.completed_at
    )
  $$;

create or replace function agent_action_json(a agent_proposed_actions) returns jsonb
  language sql stable as $$
    select jsonb_build_object(
      'id', a.id::text,
      'runId', a.run_id::text,
      'label', a.label,
      'description', coalesce(a.description, ''),
      'status', a.status,
      'riskLevel', a.risk_level,
      'targetType', a.target_type,
      'targetId', a.target_id,
      'proposedPayload', a.proposed_payload,
      'requiresHumanApproval', a.requires_human_approval,
      'approvedBy', a.approved_by::text,
      'approvedAt', a.approved_at,
      'executedAt', a.executed_at
    )
  $$;

create or replace function document_json(d documents) returns jsonb
  language sql stable as $$
    select jsonb_build_object(
      'id', d.id::text,
      'kind', d.kind,
      'title', d.title,
      'status', d.status,
      'companyId', d.company_id::text,
      'ngoId', d.ngo_id::text,
      'matchId', d.match_id::text,
      'storagePath', d.storage_path,
      'mime', d.mime,
      'sizeBytes', d.size_bytes,
      'createdBy', d.created_by::text,
      'createdAt', d.created_at,
      'publishedAt', d.published_at
    )
  $$;

create or replace function message_json(m messages) returns jsonb
  language sql stable as $$
    select jsonb_build_object(
      'id', m.id::text,
      'matchId', m.match_id::text,
      'authorId', m.author_id::text,
      'body', m.body,
      'visibility', m.visibility,
      'createdAt', m.created_at
    )
  $$;

create or replace function can_access_match(p_match_id text) returns boolean
  language sql stable as $$
    select exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where m.id::text = p_match_id
        and (
          current_role_of() = 'admin'
          or l.company_id = current_company()
          or n.ngo_id = current_ngo()
        )
    )
  $$;

create or replace function can_access_document(p_document_id text) returns boolean
  language sql stable as $$
    select exists (
      select 1
      from documents d
      where d.id::text = p_document_id
        and (
          current_role_of() = 'admin'
          or d.company_id = current_company()
          or d.ngo_id = current_ngo()
          or (d.match_id is not null and can_access_match(d.match_id::text))
        )
    )
  $$;

create or replace function create_message(
  p_match_id text,
  p_body text
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  normalized_body text;
  created messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  normalized_body := trim(coalesce(p_body, ''));
  if normalized_body = '' then
    raise exception 'empty_body';
  end if;
  if length(normalized_body) > 2000 then
    raise exception 'body_too_long';
  end if;
  if not can_access_match(p_match_id) then
    raise exception 'actor_not_allowed';
  end if;

  insert into messages (match_id, author_id, body, visibility)
  values (p_match_id::uuid, auth.uid(), normalized_body, 'customer_visible')
  returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'message.created', created.id::text, 'customer_visible');

  return message_json(created);
end;
$$;

create or replace function sync_agent_run_status(p_run_id uuid) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  total_count int;
  executed_count int;
  rejected_count int;
  pending_count int;
  approved_or_executed_count int;
begin
  select
    count(*),
    count(*) filter (where status = 'executed'),
    count(*) filter (where status = 'rejected'),
    count(*) filter (where status = 'pending'),
    count(*) filter (where status in ('approved', 'executed'))
  into total_count, executed_count, rejected_count, pending_count, approved_or_executed_count
  from agent_proposed_actions
  where run_id = p_run_id;

  if total_count = 0 then
    update agent_runs set status = 'queued', completed_at = null where id = p_run_id;
  elsif executed_count = total_count then
    update agent_runs set status = 'completed', completed_at = now() where id = p_run_id;
  elsif rejected_count = total_count then
    update agent_runs set status = 'rejected' where id = p_run_id;
  elsif pending_count > 0 then
    update agent_runs set status = 'needs_approval', completed_at = null where id = p_run_id;
  elsif approved_or_executed_count = total_count then
    update agent_runs set status = 'approved', completed_at = null where id = p_run_id;
  else
    update agent_runs set status = 'completed', completed_at = now() where id = p_run_id;
  end if;
end;
$$;

create or replace function create_agent_run(
  p_task_type text,
  p_prompt text,
  p_target_type text default null,
  p_target_id text default null,
  p_title text default null,
  p_summary text default null,
  p_findings jsonb default '[]',
  p_attachments jsonb default '[]',
  p_document jsonb default null,
  p_proposed_actions jsonb default '[]'
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  actor_company uuid;
  actor_ngo uuid;
  created_run agent_runs%rowtype;
  created_document documents%rowtype;
  action_value jsonb;
  action_target_type text;
  action_target_id text;
  actions_json jsonb;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  actor_company := current_company();
  actor_ngo := current_ngo();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  if p_task_type not in ('match_review', 'message_draft', 'social_ad', 'ops_summary') then
    raise exception 'invalid_task';
  end if;
  if trim(coalesce(p_prompt, '')) = '' then
    raise exception 'invalid_task';
  end if;
  if p_target_type is not null and p_target_type not in ('match', 'listing', 'document') then
    raise exception 'invalid_target';
  end if;
  if p_task_type in ('match_review', 'message_draft') and (p_target_type <> 'match' or p_target_id is null) then
    raise exception 'invalid_target';
  end if;
  if p_target_type is not null and p_target_id is null then
    raise exception 'invalid_target';
  end if;

  if p_target_type = 'match' and not can_access_match(p_target_id) then
    raise exception 'actor_not_allowed';
  end if;
  if p_target_type = 'listing' and not exists (
    select 1
    from listings l
    where l.id::text = p_target_id
      and (actor_role = 'admin' or (actor_role = 'corporate' and l.company_id = actor_company))
  ) then
    raise exception 'actor_not_allowed';
  end if;
  if p_target_type = 'document' and not can_access_document(p_target_id) then
    raise exception 'actor_not_allowed';
  end if;
  if p_document is not null and nullif(p_document->>'matchId', '') is not null
    and not can_access_match(p_document->>'matchId') then
    raise exception 'actor_not_allowed';
  end if;

  insert into agent_runs (
    role,
    company_id,
    ngo_id,
    task_type,
    title,
    prompt,
    status,
    summary,
    findings,
    attachments
  )
  values (
    actor_role,
    case when actor_role = 'corporate' then actor_company else null end,
    case when actor_role = 'ngo' then actor_ngo else null end,
    p_task_type,
    p_title,
    trim(p_prompt),
    case when jsonb_array_length(coalesce(p_proposed_actions, '[]'::jsonb)) > 0 then 'needs_approval'::agent_run_status else 'completed'::agent_run_status end,
    p_summary,
    coalesce(p_findings, '[]'::jsonb),
    coalesce(p_attachments, '[]'::jsonb)
  )
  returning * into created_run;

  if p_document is not null then
    insert into documents (
      kind,
      title,
      status,
      company_id,
      ngo_id,
      match_id,
      storage_path,
      mime,
      size_bytes,
      created_by
    )
    values (
      (p_document->>'kind')::document_kind,
      coalesce(nullif(p_document->>'title', ''), p_title, 'Agent document'),
      coalesce(nullif(p_document->>'status', '')::document_status, 'draft'::document_status),
      case when actor_role = 'corporate' then actor_company else null end,
      case when actor_role = 'ngo' then actor_ngo else null end,
      nullif(p_document->>'matchId', '')::uuid,
      nullif(p_document->>'storagePath', ''),
      nullif(p_document->>'mime', ''),
      nullif(p_document->>'sizeBytes', '')::bigint,
      auth.uid()
    )
    returning * into created_document;

    update agent_runs
    set produced_document_id = created_document.id
    where id = created_run.id
    returning * into created_run;
  end if;

  for action_value in select value from jsonb_array_elements(coalesce(p_proposed_actions, '[]'::jsonb))
  loop
    action_target_type := nullif(action_value->>'targetType', '');
    action_target_id := nullif(action_value->>'targetId', '');
    if action_target_type = 'document' and action_target_id is null and created_document.id is not null then
      action_target_id := created_document.id::text;
    end if;

    insert into agent_proposed_actions (
      run_id,
      label,
      description,
      risk_level,
      target_type,
      target_id,
      proposed_payload
    )
    values (
      created_run.id,
      coalesce(nullif(action_value->>'label', ''), 'Review proposed action'),
      nullif(action_value->>'description', ''),
      coalesce(nullif(action_value->>'riskLevel', ''), 'medium'),
      action_target_type,
      action_target_id,
      coalesce(action_value->'proposedPayload', '{}'::jsonb)
    );
  end loop;

  perform sync_agent_run_status(created_run.id);
  select * into created_run from agent_runs where id = created_run.id;
  select coalesce(jsonb_agg(agent_action_json(a) order by a.id), '[]'::jsonb)
    into actions_json
    from agent_proposed_actions a
    where a.run_id = created_run.id;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'agent.run.created', created_run.id::text, 'admin_only');

  return jsonb_build_object(
    'run', agent_run_json(created_run),
    'actions', actions_json,
    'document', case when created_document.id is null then null else document_json(created_document) end
  );
end;
$$;

create or replace function perform_agent_action(
  p_action_id text,
  p_operation text
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  action_row agent_proposed_actions%rowtype;
  run_row agent_runs%rowtype;
  message_body text;
  review_flag text;
  document_status text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  select * into action_row from agent_proposed_actions where id::text = p_action_id;
  if action_row.id is null then
    raise exception 'action_not_found';
  end if;

  select * into run_row from agent_runs where id = action_row.run_id;
  if run_row.id is null then
    raise exception 'action_not_found';
  end if;
  if not (
    actor_role = 'admin'
    or run_row.company_id = current_company()
    or run_row.ngo_id = current_ngo()
  ) then
    raise exception 'actor_not_allowed';
  end if;

  if p_operation = 'approve' then
    if action_row.status <> 'pending' then
      raise exception 'invalid_transition';
    end if;

    update agent_proposed_actions
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = action_row.id
    returning * into action_row;
  elsif p_operation = 'reject' then
    if action_row.status in ('executed', 'rejected') then
      raise exception 'invalid_transition';
    end if;

    update agent_proposed_actions
    set status = 'rejected'
    where id = action_row.id
    returning * into action_row;
  elsif p_operation = 'execute' then
    if action_row.status <> 'approved' or action_row.approved_by is null or action_row.approved_at is null then
      raise exception 'approval_required';
    end if;

    if action_row.target_type = 'message' and action_row.target_id is not null then
      message_body := trim(coalesce(action_row.proposed_payload->>'body', ''));
      if message_body <> '' and can_access_match(action_row.target_id) then
        insert into messages (match_id, author_id, body, visibility)
        values (action_row.target_id::uuid, auth.uid(), message_body, 'customer_visible');
      end if;
    elsif action_row.target_type = 'listing' and action_row.target_id is not null then
      review_flag := nullif(action_row.proposed_payload->>'reviewFlag', '');
      if review_flag is not null then
        update listings
        set review_flags = case
          when review_flags ? review_flag then review_flags
          else review_flags || jsonb_build_array(review_flag)
        end
        where id::text = action_row.target_id
          and (actor_role = 'admin' or (actor_role = 'corporate' and company_id = current_company()));
      end if;
    elsif action_row.target_type = 'document' and action_row.target_id is not null then
      document_status := action_row.proposed_payload->>'status';
      if document_status in ('approved', 'published') then
        update documents
        set
          status = document_status::document_status,
          published_at = case when document_status = 'published' then now() else published_at end
        where id::text = action_row.target_id
          and can_access_document(action_row.target_id);
      end if;
    end if;

    update agent_proposed_actions
    set status = 'executed', executed_at = now()
    where id = action_row.id
    returning * into action_row;
  else
    raise exception 'invalid_operation';
  end if;

  perform sync_agent_run_status(action_row.run_id);
  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'agent.action.' || p_operation, action_row.id::text, case when p_operation = 'execute' then 'customer_visible'::visibility else 'admin_only'::visibility end);

  return agent_action_json(action_row);
end;
$$;

create policy users_self on users for select
  using (id = auth.uid());

create policy users_workspace_visible on users for select
  using (
    current_role_of() = 'admin'
    or id = auth.uid()
    or (role = 'corporate' and company_id = current_company())
    or (role = 'ngo' and ngo_id = current_ngo())
  );

create policy invitations_visible on invitations for select
  using (
    current_role_of() = 'admin'
    or company_id = current_company()
    or ngo_id = current_ngo()
  );

create policy invitations_insert_same_org on invitations for insert
  with check (
    current_role_of() = 'admin'
    or company_id = current_company()
    or ngo_id = current_ngo()
  );

create policy invitation_delivery_attempts_visible on invitation_delivery_attempts for select
  using (
    exists (
      select 1
      from invitations i
      where i.id = invitation_delivery_attempts.invitation_id
        and (
          current_role_of() = 'admin'
          or i.company_id = current_company()
          or i.ngo_id = current_ngo()
        )
    )
  );

create policy idempotency_visible_self on idempotency_keys for select
  using (actor_id = auth.uid() or current_role_of() = 'admin');

grant execute on function reserve_idempotency_key(text, text, text) to authenticated;
grant execute on function complete_idempotency_key(text, text, text, int, jsonb, text, text) to authenticated;
grant execute on function create_invitation(text, user_role, uuid, uuid, text, date, text) to authenticated;
grant execute on function accept_invitation(text, text) to authenticated;
grant execute on function resend_invitation(uuid, text) to authenticated;
grant execute on function revoke_invitation(uuid) to authenticated;
grant execute on function record_invitation_delivery_attempt(uuid, invitation_delivery_operation, text, invitation_delivery_status, text, text, text) to authenticated;
grant execute on function create_message(text, text) to authenticated;
grant execute on function create_agent_run(text, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function perform_agent_action(text, text) to authenticated;

create policy plan_entitlements_read on plan_entitlements for select
  using (true);

create policy companies_visible on companies for select
  using (
    current_role_of() = 'admin'
    or id = current_company()
  );

create policy ngos_admin_all on ngos for select
  using (current_role_of() = 'admin');

create policy ngos_self on ngos for select
  using (id = current_ngo());

create policy listings_visible on listings for select
  using (
    current_role_of() = 'admin'
    or company_id = current_company()
    or exists (
      select 1
      from matches m
      join needs n on n.id = m.need_id
      where m.listing_id = listings.id
        and n.ngo_id = current_ngo()
    )
  );

create policy needs_visible on needs for select
  using (
    current_role_of() = 'admin'
    or ngo_id = current_ngo()
    or exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      where m.need_id = needs.id
        and l.company_id = current_company()
    )
  );

create policy ngos_corporate_after_match on ngos for select
  using (
    current_role_of() = 'corporate'
    and exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where n.ngo_id = ngos.id
        and l.company_id = current_company()
        and match_unlocks_contact(m)
    )
  );

create policy matches_visible on matches for select
  using (
    current_role_of() = 'admin'
    or exists (select 1 from listings l where l.id = matches.listing_id and l.company_id = current_company())
    or exists (select 1 from needs n where n.id = matches.need_id and n.ngo_id = current_ngo())
  );

create policy messages_visible on messages for select
  using (
    current_role_of() = 'admin'
    or (
      visibility = 'customer_visible'
      and exists (
        select 1
        from matches m
        join listings l on l.id = m.listing_id
        join needs n on n.id = m.need_id
        where m.id = messages.match_id
          and (l.company_id = current_company() or n.ngo_id = current_ngo())
      )
    )
  );

create policy messages_insert_match_participant on messages for insert
  with check (
    author_id = auth.uid()
    and (
      current_role_of() = 'admin'
      or (
        visibility = 'customer_visible'
        and exists (
          select 1
          from matches m
          join listings l on l.id = m.listing_id
          join needs n on n.id = m.need_id
          where m.id = messages.match_id
            and (l.company_id = current_company() or n.ngo_id = current_ngo())
        )
      )
    )
  );

create policy donation_certificates_visible on donation_certificates for select
  using (
    current_role_of() = 'admin'
    or exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where m.id = donation_certificates.match_id
        and (l.company_id = current_company() or n.ngo_id = current_ngo())
    )
  );

create policy audit_events_visible on audit_events for select
  using (
    current_role_of() = 'admin'
    or visibility = 'customer_visible'
  );

create policy agent_runs_visible on agent_runs for select
  using (
    current_role_of() = 'admin'
    or company_id = current_company()
    or ngo_id = current_ngo()
  );

create policy agent_actions_visible on agent_proposed_actions for select
  using (
    exists (
      select 1
      from agent_runs r
      where r.id = agent_proposed_actions.run_id
        and (
          current_role_of() = 'admin'
          or r.company_id = current_company()
          or r.ngo_id = current_ngo()
        )
    )
  );

create policy agent_actions_human_update on agent_proposed_actions for update
  using (
    requires_human_approval = true
    and exists (
      select 1
      from agent_runs r
      where r.id = agent_proposed_actions.run_id
        and (
          current_role_of() = 'admin'
          or r.company_id = current_company()
          or r.ngo_id = current_ngo()
        )
    )
  )
  with check (
    requires_human_approval = true
    and (status <> 'executed' or (approved_by is not null and approved_at is not null))
  );

create policy documents_visible on documents for select
  using (
    current_role_of() = 'admin'
    or company_id = current_company()
    or ngo_id = current_ngo()
    or (match_id is not null and exists (
      select 1
      from matches m
      join listings l on l.id = m.listing_id
      join needs n on n.id = m.need_id
      where m.id = documents.match_id
        and (l.company_id = current_company() or n.ngo_id = current_ngo())
    ))
  );

create policy envelopes_visible on signature_envelopes for select
  using (
    current_role_of() = 'admin'
    or exists (
      select 1
      from documents d
      where d.id = signature_envelopes.document_id
        and (d.company_id = current_company() or d.ngo_id = current_ngo())
    )
  );

alter publication supabase_realtime add table messages;

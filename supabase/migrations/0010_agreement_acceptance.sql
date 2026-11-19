-- 0010_agreement_acceptance.sql — clickwrap for SaaS terms + NGO partner agreement.
--
-- Most B2B/partner agreements are form-free under German law, so a clickwrap
-- (checkbox + versioned terms + audit trail) is legally sufficient — no DocuSign
-- needed (see Notion Rechtsfragen-Tracker for the lawyer confirmation of which
-- documents, if any, require Schriftform). This records who accepted which
-- agreement version and when, as durable evidence.

create table if not exists agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  actor_user uuid not null references users (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade,
  ngo_id uuid references ngos (id) on delete cascade,
  kind text not null,        -- e.g. 'saas_terms' | 'ngo_partner_agreement'
  version text not null,
  accepted_at timestamptz not null default now(),
  constraint agreement_scope check (not (company_id is not null and ngo_id is not null))
);

alter table agreement_acceptances enable row level security;

-- An org (and the accepting user) may read its own acceptances.
drop policy if exists agreement_acceptances_select_own on agreement_acceptances;
create policy agreement_acceptances_select_own on agreement_acceptances for select to authenticated
  using (
    actor_user = auth.uid()
    or company_id = current_company()
    or ngo_id = current_ngo()
  );

grant select on agreement_acceptances to authenticated;

-- Record an acceptance for the caller's org. Inserts are only via this RPC.
create or replace function accept_agreement(p_kind text, p_version text)
  returns agreement_acceptances
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  r agreement_acceptances%rowtype;
  v_role user_role;
  v_company uuid;
  v_ngo uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if coalesce(trim(p_kind), '') = '' or coalesce(trim(p_version), '') = '' then
    raise exception 'invalid_agreement';
  end if;

  v_role := current_role_of();
  if v_role = 'corporate' then
    v_company := current_company();
  elsif v_role = 'ngo' then
    v_ngo := current_ngo();
  end if;

  insert into agreement_acceptances (actor_user, company_id, ngo_id, kind, version)
  values (auth.uid(), v_company, v_ngo, trim(p_kind), trim(p_version))
  returning * into r;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'agreement.accepted', trim(p_kind) || ':' || trim(p_version), 'customer_visible');

  return r;
end;
$$;

grant execute on function accept_agreement(text, text) to authenticated;

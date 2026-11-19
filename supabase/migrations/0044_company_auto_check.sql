-- 0044 — Automatic company check (ADR 0027 C3).
--
-- A company that gives its EU VAT ID and website is checked without a human:
--   * VAT ID   valid in EU VIES
--   * domain   the contact email is a company domain (not freemail)
--   * website  reachable
-- All three pass -> verified automatically. Anything else -> the company goes to
-- Ops for manual review (verification_state = 'review'). A company Ops already
-- rejected is never auto-approved.
--
-- The network checks run in the app server, so the result must be unforgeable:
-- record_company_check is executable by the service role only, never by a user
-- session. Every outcome is audited; the results stay on company_checks so Ops
-- can read them in the risk queue.

alter table companies
  add column if not exists vat_id text check (char_length(vat_id) <= 20),
  add column if not exists website text check (char_length(website) <= 300);

create table if not exists company_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  vat_ok boolean not null,
  vat_name text,
  domain_ok boolean not null,
  website_ok boolean not null,
  outcome text not null check (outcome in ('approved', 'manual_review')),
  created_at timestamptz not null default now()
);

create index if not exists company_checks_company_idx on company_checks (company_id, created_at desc);

alter table company_checks enable row level security;
revoke all on company_checks from anon, authenticated;
grant select on company_checks to authenticated;

drop policy if exists company_checks_read on company_checks;
create policy company_checks_read on company_checks for select to authenticated
  using (current_role_of() = 'admin' or company_id = current_company());

create or replace function record_company_check(
  p_company uuid,
  p_vat_id text,
  p_website text,
  p_vat_ok boolean,
  p_vat_name text,
  p_domain_ok boolean,
  p_website_ok boolean
) returns company_checks
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_company companies%rowtype;
  v_outcome text;
  c company_checks%rowtype;
begin
  select * into v_company from companies where id = p_company for update;
  if not found then
    raise exception 'company_not_found';
  end if;
  if p_vat_ok is null or p_domain_ok is null or p_website_ok is null then
    raise exception 'invalid_check';
  end if;

  v_outcome := case when p_vat_ok and p_domain_ok and p_website_ok then 'approved' else 'manual_review' end;

  insert into company_checks (company_id, vat_ok, vat_name, domain_ok, website_ok, outcome)
  values (p_company, p_vat_ok, nullif(left(p_vat_name, 200), ''), p_domain_ok, p_website_ok, v_outcome)
  returning * into c;

  update companies
    set vat_id = left(p_vat_id, 20),
        website = left(p_website, 300),
        verification_state = (case
          when v_company.verification_state = 'rejected' then 'rejected'
          when v_outcome = 'approved' then 'verified'
          when v_company.verification_state = 'verified' then 'verified'
          else 'review'
        end)::company_verification,
        verified_at = case
          when v_outcome = 'approved' and v_company.verification_state <> 'rejected' then coalesce(v_company.verified_at, current_date)
          else v_company.verified_at
        end
    where id = p_company;

  insert into audit_events (actor, action, target, visibility)
  values ('system',
          case when v_outcome = 'approved' and v_company.verification_state <> 'rejected'
               then 'company.auto_verified' else 'company.check_needs_review' end,
          p_company::text, 'admin_only');

  return c;
end;
$$;

revoke all on function record_company_check(uuid, text, text, boolean, text, boolean, boolean) from public, anon, authenticated;
grant execute on function record_company_check(uuid, text, text, boolean, text, boolean, boolean) to service_role;

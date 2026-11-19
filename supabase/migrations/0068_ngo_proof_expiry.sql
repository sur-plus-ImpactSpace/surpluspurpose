-- 0068 — REQ-NGO-06 · NGO proof expiry + 60-day reminders
--
-- Phase 1 brief: notice date + assessment period are mandatory for notice-based
-- org types; validity is derived; 60-day reminder to NGO + Ops; on expiry
-- verification is suspended (existing commitments stand, no new promises).
-- Public-law bodies (org_type = public_body) have no notice / no expiry path
-- (ADR 0030 / ADR 0036).

-- 1. Columns ------------------------------------------------------------------

alter table ngos
  add column if not exists proof_notice_date date,
  add column if not exists proof_assessment_period_years int,
  add column if not exists proof_valid_until date,
  add column if not exists proof_expiry_reminded_at timestamptz;

alter table ngos
  drop constraint if exists ngos_proof_assessment_period_years_check;
alter table ngos
  add constraint ngos_proof_assessment_period_years_check
  check (
    proof_assessment_period_years is null
    or (proof_assessment_period_years >= 1 and proof_assessment_period_years <= 20)
  );

comment on column ngos.proof_notice_date is
  'REQ-NGO-06 · Bescheid / notice date. Null for public_body.';
comment on column ngos.proof_assessment_period_years is
  'REQ-NGO-06 · Assessment period in years; validity = notice + years.';
comment on column ngos.proof_valid_until is
  'REQ-NGO-06 · Derived validity end date; never a free-floating Ops override.';
comment on column ngos.proof_expiry_reminded_at is
  'REQ-NGO-06 · When the 60-day reminder was sent.';

create index if not exists ngos_proof_valid_until_idx
  on ngos (proof_valid_until)
  where proof_valid_until is not null and verification_state = 'verified';

-- 2. Helpers ------------------------------------------------------------------

create or replace function ngo_requires_proof_expiry(p_org_type ngo_org_type)
  returns boolean
  language sql
  immutable
as $$
  select p_org_type is not null and p_org_type <> 'public_body';
$$;

comment on function ngo_requires_proof_expiry(ngo_org_type) is
  'Notice-based org types need proof expiry (REQ-NGO-06); public_body does not.';

create or replace function derive_proof_valid_until(p_notice date, p_years int)
  returns date
  language plpgsql
  immutable
as $$
begin
  if p_notice is null then
    raise exception 'invalid_proof_notice_date';
  end if;
  if p_years is null or p_years < 1 or p_years > 20 then
    raise exception 'invalid_proof_assessment_period';
  end if;
  return (p_notice + (p_years * interval '1 year'))::date;
end;
$$;

-- Verified + (public_body OR no recorded validity OR still valid today).
create or replace function ngo_is_verified(p_ngo uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from ngos n
    where n.id = p_ngo
      and n.verification_state = 'verified'
      and (
        not ngo_requires_proof_expiry(n.org_type)
        or n.proof_valid_until is null
        or n.proof_valid_until >= current_date
      )
  );
$$;

revoke all on function ngo_is_verified(uuid) from public;
grant execute on function ngo_is_verified(uuid) to authenticated, anon;

-- 3. set_ngo_verification — proof fields on approve -------------------------------

create or replace function set_ngo_verification(
  p_ngo_id uuid,
  p_action text,
  p_proof_notice_date date default null,
  p_proof_assessment_period_years int default null
) returns ngos
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  n ngos%rowtype;
  v_target ngo_verification;
  promoted int;
  v_valid_until date;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if not is_ops() then
    raise exception 'actor_not_allowed';
  end if;

  v_target := case p_action
    when 'approve' then 'verified'
    when 'request_info' then 'pending_info'
    when 'reject' then 'rejected'
    when 'start_review' then 'review'
    else null
  end::ngo_verification;

  if v_target is null then
    raise exception 'invalid_action';
  end if;

  select * into n from ngos where id = p_ngo_id for update;
  if not found then
    raise exception 'ngo_not_found';
  end if;

  if p_action = 'approve'
     and not exists (select 1 from ngo_verification_documents where ngo_id = n.id) then
    raise exception 'verification_document_required';
  end if;

  if p_action = 'approve' then
    if ngo_requires_proof_expiry(n.org_type) then
      if p_proof_notice_date is null or p_proof_assessment_period_years is null then
        raise exception 'proof_validity_required';
      end if;
      v_valid_until := derive_proof_valid_until(
        p_proof_notice_date,
        p_proof_assessment_period_years
      );
      update ngos
        set verification_state = v_target,
            verified_at = now()::date,
            proof_notice_date = p_proof_notice_date,
            proof_assessment_period_years = p_proof_assessment_period_years,
            proof_valid_until = v_valid_until,
            proof_expiry_reminded_at = null
        where id = n.id
        returning * into n;
    else
      update ngos
        set verification_state = v_target,
            verified_at = now()::date,
            proof_notice_date = null,
            proof_assessment_period_years = null,
            proof_valid_until = null,
            proof_expiry_reminded_at = null
        where id = n.id
        returning * into n;
    end if;
  else
    update ngos
      set verification_state = v_target,
          verified_at = null,
          proof_expiry_reminded_at = null
      where id = n.id
      returning * into n;
  end if;

  if p_action = 'approve' then
    update needs
      set state = 'open'
      where ngo_id = n.id and state = 'draft';
    get diagnostics promoted = row_count;
    if promoted > 0 then
      insert into audit_events (actor, action, target, visibility)
      values (auth.uid()::text, 'need.drafts_promoted:' || promoted::text, n.id::text, 'admin_only');
    end if;
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'ngo.' || p_action, n.id::text, 'admin_only');

  return n;
end;
$$;

revoke all on function set_ngo_verification(uuid, text) from public, anon, authenticated;
revoke all on function set_ngo_verification(uuid, text, date, int) from public, anon;
grant execute on function set_ngo_verification(uuid, text, date, int) to authenticated;

-- Drop the old 2-arg overload if Postgres kept both (0061 signature).
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_ngo_verification'
      and pg_get_function_identity_arguments(p.oid) = 'uuid, text'
  ) then
    drop function set_ngo_verification(uuid, text);
  end if;
end $$;

-- 4. Timed jobs ----------------------------------------------------------------

create or replace function notify_ngo_and_ops(
  p_ngo uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_dedupe_key text
) returns void
  language sql
  security definer
  set search_path = public
as $$
  insert into notifications (user_id, match_id, kind, title, body, dedupe_key)
  select u.id, null, p_kind, p_title, p_body, p_dedupe_key
  from users u
  where u.ngo_id = p_ngo
     or u.role in ('admin', 'editor')
  on conflict (user_id, dedupe_key) do nothing
$$;

revoke all on function notify_ngo_and_ops(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function warn_expiring_ngo_proofs(p_now timestamptz default now())
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_from date := (p_now::date);
  v_until date := (p_now::date + interval '60 days')::date;
begin
  for r in
    select id, name, proof_valid_until
    from ngos
    where verification_state = 'verified'
      and ngo_requires_proof_expiry(org_type)
      and proof_valid_until is not null
      and proof_valid_until >= v_from
      and proof_valid_until <= v_until
      and proof_expiry_reminded_at is null
    for update
  loop
    perform notify_ngo_and_ops(
      r.id,
      'ngo_proof_expiring',
      'Charitable-status proof is expiring',
      'Your verification proof is valid until ' || r.proof_valid_until::text
        || '. Upload a renewed notice so Ops can re-approve before new matches are blocked.',
      'ngo-proof-expiring:' || r.id::text || ':' || r.proof_valid_until::text
    );
    update ngos
      set proof_expiry_reminded_at = p_now
      where id = r.id;
    insert into audit_events (actor, action, target, visibility)
    values ('system', 'ngo.proof_expiry_reminded', r.id::text, 'admin_only');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function warn_expiring_ngo_proofs(timestamptz) from public, anon, authenticated;

create or replace function expire_ngo_proofs(p_now timestamptz default now())
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_today date := p_now::date;
begin
  for r in
    select id, proof_valid_until
    from ngos
    where verification_state = 'verified'
      and ngo_requires_proof_expiry(org_type)
      and proof_valid_until is not null
      and proof_valid_until < v_today
    for update
  loop
    update ngos
      set verification_state = 'verification_pending',
          verified_at = null,
          proof_expiry_reminded_at = null
      where id = r.id;

    perform notify_ngo_and_ops(
      r.id,
      'ngo_proof_expired',
      'Charitable-status proof expired',
      'Verification is suspended. Existing matches continue, but no new promises can be made until Ops re-approves a renewed proof.',
      'ngo-proof-expired:' || r.id::text || ':' || r.proof_valid_until::text
    );

    insert into audit_events (actor, action, target, visibility)
    values ('system', 'ngo.proof_expired', r.id::text, 'admin_only');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function expire_ngo_proofs(timestamptz) from public, anon, authenticated;

-- 5. Wire into run_scheduled_job (0057) ----------------------------------------

create or replace function run_scheduled_job(
  p_job text,
  p_now timestamptz default now()
)
  returns scheduler_job_runs
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_run scheduler_job_runs%rowtype;
  v_count int := 0;
begin
  if p_job is null or btrim(p_job) = '' then
    raise exception 'unknown_scheduled_job';
  end if;

  insert into scheduler_job_runs (job_name, started_at, status)
  values (p_job, p_now, 'running')
  returning * into v_run;

  begin
    if p_job = 'expire_stale_proposals' then
      v_count := expire_stale_proposals(p_now);
    elsif p_job = 'warn_expiring_proposals' then
      v_count := warn_expiring_proposals(p_now);
    elsif p_job = 'warn_expiring_ngo_proofs' then
      v_count := warn_expiring_ngo_proofs(p_now);
    elsif p_job = 'expire_ngo_proofs' then
      v_count := expire_ngo_proofs(p_now);
    else
      raise exception 'unknown_scheduled_job';
    end if;

    update scheduler_job_runs
      set finished_at = clock_timestamp(),
          records_processed = coalesce(v_count, 0),
          status = 'ok'
      where id = v_run.id
      returning * into v_run;

    insert into audit_events (actor, action, target, visibility)
    values (
      'system',
      'scheduler.job_ok',
      v_run.id::text,
      'admin_only'
    );
  exception
    when others then
      update scheduler_job_runs
        set finished_at = clock_timestamp(),
            records_processed = null,
            status = 'failed',
            error_text = left(sqlerrm, 2000)
        where id = v_run.id
        returning * into v_run;

      insert into audit_events (actor, action, target, visibility)
      values (
        'system',
        'scheduler.job_failed',
        v_run.id::text,
        'admin_only'
      );
  end;

  return v_run;
end;
$$;

revoke all on function run_scheduled_job(text, timestamptz) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'warn-expiring-ngo-proofs';
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-ngo-proofs';
    perform cron.schedule(
      'warn-expiring-ngo-proofs',
      '0 4 * * *',
      $$select public.run_scheduled_job('warn_expiring_ngo_proofs')$$
    );
    perform cron.schedule(
      'expire-ngo-proofs',
      '15 4 * * *',
      $$select public.run_scheduled_job('expire_ngo_proofs')$$
    );
  else
    raise notice 'pg_cron unavailable: schedule warn_expiring_ngo_proofs / expire_ngo_proofs via run_scheduled_job externally';
  end if;
end
$cron$;

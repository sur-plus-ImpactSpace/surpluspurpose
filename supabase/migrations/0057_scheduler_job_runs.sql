-- 0057 — Scheduler job run log (REQ-OPS-13).
--
-- Timed jobs (expire_stale_proposals, warn_expiring_proposals) already exist and
-- are scheduled with pg_cron. What was missing: a durable run log (start, end,
-- how many records) and an Ops-visible task when a run fails.
--
--   * scheduler_job_runs — one row per invocation
--   * run_scheduled_job() — wrapper cron calls; never raises to the scheduler
--     (failure is recorded and becomes an Ops risk-queue item instead)
--   * acknowledge_scheduler_job_run() — admin clears a failed run from the queue
--   * Cron entries re-pointed at the wrapper

create table if not exists scheduler_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_processed int,
  status text not null
    check (status in ('running', 'ok', 'failed')),
  error_text text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists scheduler_job_runs_job_started_idx
  on scheduler_job_runs (job_name, started_at desc);

create index if not exists scheduler_job_runs_open_failures_idx
  on scheduler_job_runs (started_at desc)
  where status = 'failed' and acknowledged_at is null;

alter table scheduler_job_runs enable row level security;
revoke all on scheduler_job_runs from anon, authenticated;
grant select on scheduler_job_runs to authenticated;

drop policy if exists scheduler_job_runs_admin_read on scheduler_job_runs;
create policy scheduler_job_runs_admin_read on scheduler_job_runs
  for select to authenticated
  using (current_role_of() = 'admin');

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

create or replace function acknowledge_scheduler_job_run(p_run_id uuid)
  returns scheduler_job_runs
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_run scheduler_job_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  select * into v_run from scheduler_job_runs where id = p_run_id for update;
  if not found then
    raise exception 'scheduler_job_run_not_found';
  end if;
  if v_run.status <> 'failed' then
    raise exception 'scheduler_job_run_not_failed';
  end if;
  if v_run.acknowledged_at is not null then
    return v_run;
  end if;

  update scheduler_job_runs
    set acknowledged_at = now(),
        acknowledged_by = auth.uid()
    where id = p_run_id
    returning * into v_run;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'scheduler.job_acknowledged', p_run_id::text, 'admin_only');

  return v_run;
end;
$$;

revoke all on function acknowledge_scheduler_job_run(uuid) from public, anon;
grant execute on function acknowledge_scheduler_job_run(uuid) to authenticated;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-stale-proposals';
    perform cron.unschedule(jobid) from cron.job where jobname = 'warn-expiring-proposals';
    perform cron.schedule(
      'expire-stale-proposals',
      '15 3 * * *',
      $$select public.run_scheduled_job('expire_stale_proposals')$$
    );
    perform cron.schedule(
      'warn-expiring-proposals',
      '30 3 * * *',
      $$select public.run_scheduled_job('warn_expiring_proposals')$$
    );
  else
    raise notice 'pg_cron unavailable: schedule run_scheduled_job() externally';
  end if;
end
$cron$;

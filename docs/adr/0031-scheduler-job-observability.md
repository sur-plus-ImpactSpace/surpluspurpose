# ADR 0031: Scheduler job observability (REQ-OPS-13)

Date: 2026-11-10

## Status

Accepted — Phase 1 M0.

## Context

Timed jobs (`expire_stale_proposals`, `warn_expiring_proposals`) already run via
`pg_cron`, but a successful or failed run left no durable record. Phase 1
requires every run to log start, end, and records processed, and a failed run
to create an Ops-visible task.

## Decision

1. Table `scheduler_job_runs` records each invocation (`running` → `ok`|`failed`).
2. Cron calls `run_scheduled_job(job_name)` instead of the worker directly. The
   wrapper never raises to the scheduler: failures are stored and audited.
3. Unacknowledged `failed` rows appear in `buildOpsRiskQueue` as
   `scheduler_job_failure` (high risk). Admins clear them with
   `acknowledge_scheduler_job_run`.
4. API roles cannot execute `run_scheduled_job` (same posture as the workers).

## Consequences

- Ops sees silent cron failures without reading Postgres logs.
- Full generic Ops task entity (REQ-OPS-02/11) remains later; failed job runs
  are the Phase 1 task shape for the scheduler.

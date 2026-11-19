-- pgTAP: scheduler job run log + failure → Ops task (REQ-OPS-13 / 0057).
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

create or replace function tests_authenticate(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev');
insert into users (id, email, role) values
  ('00000000-0000-0000-0000-00000000ad01', 'ops@test.dev', 'admin');
insert into companies (id, name, plan) values
  ('00000000-0000-0000-0000-0000000000c1', 'Acme Test GmbH', 'seed');
insert into ngos (id, name) values
  ('00000000-0000-0000-0000-0000000000e1', 'Kleiderkammer Test e.V.');
update companies set verification_state = 'verified';
update ngos set verification_state = 'verified';

insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Stale', 'IT', 1, 'match_pending');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'N1', 'IT', 'open');
insert into matches (id, listing_id, need_id, quantity, state, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'proposed', now() - interval '15 days');

-- Successful wrapped run: logs start/end/count and expires the stale proposal.
select is(
  (select status from run_scheduled_job('expire_stale_proposals')),
  'ok',
  'wrapper marks a successful run as ok'
);
select is(
  (select records_processed from scheduler_job_runs order by started_at desc limit 1),
  1,
  'successful run records how many rows it processed'
);
select is(
  (select finished_at is not null from scheduler_job_runs order by started_at desc limit 1),
  true,
  'successful run records a finish timestamp'
);
select is(
  (select state from matches where id = '00000000-0000-0000-0000-0000000000a1'),
  'expired'::match_state,
  'wrapper still performs the underlying job'
);
select is(
  (select count(*)::int from audit_events where action = 'scheduler.job_ok'),
  1,
  'successful run is audited'
);

-- Warning job with nothing in the window still logs a zero-count ok run.
select is(
  (select records_processed from run_scheduled_job('warn_expiring_proposals')),
  0,
  'empty warning sweep still logs records_processed = 0'
);

-- Unknown job name fails closed into a failed run row (Ops task), not a raised error.
select is(
  (select status from run_scheduled_job('not_a_real_job')),
  'failed',
  'unknown job becomes a failed run rather than crashing the scheduler'
);
select ok(
  (select error_text from scheduler_job_runs where status = 'failed' order by started_at desc limit 1)
    like '%unknown_scheduled_job%',
  'failed run stores the error text'
);
select is(
  (select count(*)::int from audit_events where action = 'scheduler.job_failed'),
  1,
  'failed run is audited'
);

-- Admin can acknowledge the failure so it leaves the Ops queue.
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select is(
  (select acknowledged_at is not null from acknowledge_scheduler_job_run(
    (select id from scheduler_job_runs where status = 'failed' order by started_at desc limit 1)
  )),
  true,
  'admin can acknowledge a failed run'
);

select ok(
  not has_function_privilege('authenticated', 'run_scheduled_job(text, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'run_scheduled_job(text, timestamptz)', 'execute'),
  'API roles cannot invoke the scheduler wrapper'
);

select ok(
  has_function_privilege('authenticated', 'acknowledge_scheduler_job_run(uuid)', 'execute'),
  'authenticated admins may acknowledge failed runs'
);

select * from finish();
rollback;

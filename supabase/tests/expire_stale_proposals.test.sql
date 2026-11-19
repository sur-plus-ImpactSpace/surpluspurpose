-- pgTAP tests for proposal expiry (ADR 0028 D5). Rolls back.
begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

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

-- Matching needs verified organisations (0038).
update companies set verification_state = 'verified';
update ngos set verification_state = 'verified';
insert into listings (id, company_id, title, category, quantity, state) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000c1', 'Stale', 'IT', 1, 'match_pending'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000c1', 'Fresh', 'IT', 1, 'match_pending'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000c1', 'Reacted', 'IT', 1, 'match_pending');
insert into needs (id, ngo_id, title, category, state) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1', 'N1', 'IT', 'open'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000e1', 'N2', 'IT', 'open'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000e1', 'N3', 'IT', 'matched');

-- 15 days old and unanswered, 13 days old, 20 days old but already confirmed.
insert into matches (id, listing_id, need_id, quantity, state, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 1, 'proposed', now() - interval '15 days'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d2', 1, 'proposed', now() - interval '13 days'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000d3', 1, 'ngo_confirmed', now() - interval '20 days');

select is(expire_stale_proposals(), 1, 'exactly the stale proposal expires');
select is((select state from matches where id = '00000000-0000-0000-0000-0000000000a1'), 'expired'::match_state, 'stale proposal is expired');
select is((select state from matches where id = '00000000-0000-0000-0000-0000000000a2'), 'proposed'::match_state, 'a 13-day-old proposal is left alone');
select is((select state from matches where id = '00000000-0000-0000-0000-0000000000a3'), 'ngo_confirmed'::match_state, 'a proposal somebody reacted to never expires');
select is((select state from listings where id = '00000000-0000-0000-0000-0000000000b1'), 'open'::listing_state, 'the expired proposal releases its listing');
select is((select state from listings where id = '00000000-0000-0000-0000-0000000000b2'), 'match_pending'::listing_state, 'a live proposal keeps its listing');
select is((select committed_at from matches where id = '00000000-0000-0000-0000-0000000000a1'), null, 'expiry consumes no quota');
select is((select count(*)::int from audit_events where action = 'match.expired'), 1, 'the expiry is audited');
select is(expire_stale_proposals(), 0, 'running it again is a no-op');

-- Time moves on: the 13-day-old proposal crosses the line.
select is(expire_stale_proposals(now() + interval '2 days'), 1, 'it expires once it is 14 days old');

-- Expired is terminal for everyone, Ops included.
select tests_authenticate('00000000-0000-0000-0000-00000000ad01');
select throws_ok(
  $$ select transition_match('00000000-0000-0000-0000-0000000000a1', 'cancelled') $$,
  'P0001', 'terminal_state', 'an expired match cannot be cancelled or revived'
);

-- The same pair may be proposed again.
select is(
  (select state from propose_match('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1') p),
  'proposed'::match_state,
  'an expired pair can be proposed again'
);

select ok(
  not has_function_privilege('authenticated', 'expire_stale_proposals(timestamptz)', 'execute')
    and not has_function_privilege('anon', 'expire_stale_proposals(timestamptz)', 'execute'),
  'API roles cannot run the expiry job'
);

select * from finish();
rollback;

-- pgTAP: the shared rate limit counts across callers and is service-role only (0052). Rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select is((select allowed from reserve_rate_limit('u1:route', 2, 60)), true, 'first request is allowed');
select is((select remaining from reserve_rate_limit('u1:route', 2, 60)), 0, 'second request uses the last slot');
select is((select allowed from reserve_rate_limit('u1:route', 2, 60)), false, 'third request is refused');
select is((select allowed from reserve_rate_limit('u2:route', 2, 60)), true, 'another key has its own budget');

update rate_limits set window_start = now() - interval '61 seconds' where key = 'u1:route';
select is((select allowed from reserve_rate_limit('u1:route', 2, 60)), true, 'a new window starts after the old one ends');
select is((select count from rate_limits where key = 'u1:route'), 1, 'and the counter restarts');

select throws_ok($$ select * from reserve_rate_limit('', 2, 60) $$, 'P0001', 'invalid_rate_limit', 'a blank key is refused');
select ok(
  not has_function_privilege('authenticated', 'reserve_rate_limit(text,int,int)', 'execute')
    and not has_function_privilege('anon', 'reserve_rate_limit(text,int,int)', 'execute'),
  'user sessions cannot spend anyone''s budget'
);
select ok(has_function_privilege('service_role', 'reserve_rate_limit(text,int,int)', 'execute'), 'the service role can');

select * from finish();
rollback;

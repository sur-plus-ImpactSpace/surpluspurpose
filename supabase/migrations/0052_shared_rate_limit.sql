-- 0052 — Rate limits that hold across all servers.
--
-- The route limiter lived in each server's memory, so N instances allowed N
-- times the limit and a restart reset it. The counter now lives in Postgres,
-- which every instance already shares (no new infrastructure): a fixed window
-- per key, advanced atomically by one upsert.
--
-- reserve_rate_limit is executable by the service role only. If any session
-- could call it, a caller could spend somebody else's budget by choosing their
-- key. The app server calls it with the service key and falls back to its
-- in-memory limiter if the database is unreachable (degrade, not outage).

create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

create or replace function reserve_rate_limit(p_key text, p_limit int, p_window_seconds int)
  returns table (allowed boolean, remaining int, reset_at timestamptz)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int;
  v_start timestamptz;
begin
  if coalesce(trim(p_key), '') = '' or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit';
  end if;

  insert into rate_limits as r (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when r.window_start + make_interval(secs => p_window_seconds) <= now() then now()
          else r.window_start end,
        count = case
          when r.window_start + make_interval(secs => p_window_seconds) <= now() then 1
          else r.count + 1 end
  returning r.count, r.window_start into v_count, v_start;

  -- Housekeeping: stale windows are of no use; sweep them now and then.
  if random() < 0.01 then
    delete from rate_limits where window_start < now() - interval '1 day';
  end if;

  return query select v_count <= p_limit,
                      greatest(0, p_limit - v_count),
                      v_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function reserve_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function reserve_rate_limit(text, int, int) to service_role;

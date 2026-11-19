-- 0042 — In-app notifications and the proposal expiry warning (ADR 0028 D5).
--
-- Volunteers at NGOs should not lose a proposal silently: three days before a
-- `proposed` match expires (14 days, 0035) both sides get a reminder.
--
--   * notifications          one row per user and event. Users read their own
--                            rows; nothing in the API can write them.
--   * notify_match_parties() internal helper: every user of the listing's
--                            company and of the need's NGO, once per dedupe key.
--   * warn_expiring_proposals() run daily by pg_cron, not callable by API roles.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  match_id uuid references matches (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;
revoke all on notifications from anon, authenticated;
grant select on notifications to authenticated;

drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications for select to authenticated
  using (user_id = auth.uid());

create or replace function notify_match_parties(
  p_match uuid,
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
  select u.id, p_match, p_kind, p_title, p_body, p_dedupe_key
  from matches m
  join listings l on l.id = m.listing_id
  join needs n on n.id = m.need_id
  join users u on (u.company_id = l.company_id or u.ngo_id = n.ngo_id)
  where m.id = p_match
  on conflict (user_id, dedupe_key) do nothing
$$;

revoke all on function notify_match_parties(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function warn_expiring_proposals(p_now timestamptz default now())
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  -- 14 days to live, warned from day 11 (three days before).
  for v_id in
    select id from matches
    where state = 'proposed'
      and created_at <= p_now - interval '11 days'
      and created_at > p_now - interval '14 days'
  loop
    perform notify_match_parties(
      v_id,
      'proposal_expiring',
      'A match proposal is about to expire',
      'This proposal has been waiting for a reply and expires in about three days. Open it to confirm or leave it to lapse.',
      'expiring:' || v_id::text
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function warn_expiring_proposals(timestamptz) from public, anon, authenticated;

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'warn-expiring-proposals';
    perform cron.schedule('warn-expiring-proposals', '30 3 * * *', 'select public.warn_expiring_proposals()');
  else
    raise notice 'pg_cron unavailable: schedule warn_expiring_proposals() externally';
  end if;
end
$cron$;

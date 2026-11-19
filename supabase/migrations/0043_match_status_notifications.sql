-- 0043 — Tell both sides when a match changes status.
--
-- One trigger on matches covers every path that moves a match (propose_match,
-- transition_match, fail_match, expire_stale_proposals), so no RPC has to
-- remember to notify. Messages are mirrored in matchStatusMessage() in
-- packages/domain for the preview repository.

create or replace function notify_match_state_change() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE' and new.state = old.state then
    return new;
  end if;

  select title, body into v_title, v_body from (values
    ('proposed', 'A match was proposed', 'Ops proposed a match. Open it to review and confirm.'),
    ('ngo_confirmed', 'The NGO confirmed the match', 'The NGO confirmed the fit. The company confirms next.'),
    ('both_confirmed', 'Both sides confirmed', 'The match is confirmed and contact details are unlocked.'),
    ('in_transit', 'The goods are on their way', 'Pickup is done and delivery is under way.'),
    ('delivered', 'The goods were delivered', 'Delivery is recorded. The NGO confirms receipt next.'),
    ('completed', 'The match is complete', 'Receipt is confirmed and the documents are ready.'),
    ('cancelled', 'The match was cancelled', 'This match was withdrawn before shipping.'),
    ('expired', 'The proposal expired', 'Nobody confirmed it in time, so it lapsed. No quota was used.'),
    ('failed', 'Delivery failed', 'Delivery did not work out after shipping. Ops reviews what happened.')
  ) as s(state, title, body) where s.state = new.state::text;

  if v_title is not null then
    perform notify_match_parties(new.id, 'match_status', v_title, v_body, 'status:' || new.id::text || ':' || new.state::text);
  end if;

  return new;
end;
$$;

revoke all on function notify_match_state_change() from public, anon, authenticated;

drop trigger if exists matches_notify_state_change on matches;
create trigger matches_notify_state_change
  after insert or update of state on matches
  for each row execute function notify_match_state_change();

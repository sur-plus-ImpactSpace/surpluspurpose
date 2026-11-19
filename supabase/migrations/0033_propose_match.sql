-- 0033 — Ops proposes a match (ADR 0028 D1: curated, not automatic).
--
-- Mirrors repository.matches.propose: admin only, the listing and the need must
-- both be open, a pair is proposed at most once. The listing moves to
-- match_pending (as in the seed data) so it cannot be offered twice; the need
-- stays open until the NGO confirms. Quota is untouched: it is consumed at
-- both_confirmed (ADR 0026), never by a proposal.

create or replace function propose_match(
  p_listing_id uuid,
  p_need_id uuid
) returns matches
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_listing listings%rowtype;
  v_need needs%rowtype;
  m matches%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if current_role_of() is null then
    raise exception 'actor_not_available';
  end if;
  if current_role_of() <> 'admin' then
    raise exception 'actor_not_allowed';
  end if;

  -- Lock the listing first so two concurrent proposals cannot both see it open.
  select * into v_listing from listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found';
  end if;
  select * into v_need from needs where id = p_need_id for update;
  if not found then
    raise exception 'need_not_found';
  end if;

  if v_listing.state <> 'open' then
    raise exception 'listing_not_open';
  end if;
  if v_need.state <> 'open' then
    raise exception 'need_not_open';
  end if;
  if exists (select 1 from matches where listing_id = p_listing_id and need_id = p_need_id) then
    raise exception 'match_exists';
  end if;

  insert into matches (listing_id, need_id, state)
  values (p_listing_id, p_need_id, 'proposed')
  returning * into m;

  update listings set state = 'match_pending' where id = p_listing_id;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'match.proposed', m.id::text, 'customer_visible');

  return m;
end;
$$;

revoke all on function propose_match(uuid, uuid) from public;
grant execute on function propose_match(uuid, uuid) to authenticated;

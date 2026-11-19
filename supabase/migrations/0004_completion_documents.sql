-- 0004 — M2/C3: completing a match guarantees evidence documents.
--
-- Extends transition_match (0002): on the transition to `completed` an
-- approved donation certificate and CSRD note exist for the match — existing
-- drafts are promoted, missing documents are created. Content is rendered on
-- the fly by the app from match data; no file is stored for generated docs.

create or replace function ensure_completion_documents(p_match_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_listing listings%rowtype;
  v_title text;
  spec record;
begin
  select l.* into v_listing
  from listings l
  join matches m on m.listing_id = l.id
  where m.id = p_match_id;

  for spec in
    select * from (values
      ('certificate'::document_kind, 'Donation certificate'),
      ('report'::document_kind, 'CSRD evidence note')
    ) as s(kind, label)
  loop
    v_title := spec.label || ' · ' || coalesce(v_listing.title, p_match_id::text);

    update documents
      set status = case when status in ('approved', 'published') then status else 'approved' end,
          published_at = coalesce(published_at, now())
      where match_id = p_match_id and kind = spec.kind;

    if not found then
      insert into documents (kind, title, status, company_id, ngo_id, match_id, published_at)
      values (spec.kind, v_title, 'approved', v_listing.company_id, null, p_match_id, now());
    end if;
  end loop;
end;
$$;

-- Recreate transition_match with the completion hook (body otherwise
-- identical to 0002).
create or replace function transition_match(
  p_match_id uuid,
  p_next_state match_state
) returns matches
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  m matches%rowtype;
  v_listing listings%rowtype;
  v_need needs%rowtype;
  v_company companies%rowtype;
  v_allowance int;
  v_period_start date;
  v_used int;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  select * into m from matches where id = p_match_id for update;
  if not found then
    raise exception 'match_not_found';
  end if;

  if m.state in ('cancelled', 'completed') then
    raise exception 'terminal_state';
  end if;

  select * into v_listing from listings where id = m.listing_id;
  select * into v_need from needs where id = m.need_id;

  if p_next_state = 'cancelled' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

    update matches set state = 'cancelled' where id = m.id returning * into m;

    insert into audit_events (actor, action, target, visibility)
    values (auth.uid()::text, 'match.cancelled', m.id::text, 'admin_only');

    return m;
  end if;

  if m.state = 'proposed' and p_next_state = 'ngo_confirmed' then
    if actor_role <> 'ngo' or v_need.ngo_id is distinct from current_ngo() then
      raise exception 'actor_not_allowed';
    end if;
    update needs set state = 'matched' where id = v_need.id;

  elsif m.state = 'ngo_confirmed' and p_next_state = 'both_confirmed' then
    if actor_role <> 'corporate' or v_listing.company_id is distinct from current_company() then
      raise exception 'actor_not_allowed';
    end if;

    select * into v_company from companies where id = v_listing.company_id;
    select matches_per_year into v_allowance from plan_entitlements where plan = v_company.plan;

    if v_allowance is not null then
      v_period_start := v_company.contract_started_at
        + make_interval(years => greatest(0, (extract(year from age(now(), v_company.contract_started_at)))::int));

      select count(*) into v_used
      from matches cm
      join listings cl on cl.id = cm.listing_id
      where cl.company_id = v_company.id
        and cm.committed_at is not null
        and cm.committed_at >= v_period_start
        and cm.committed_at < v_period_start + interval '1 year';

      if v_used >= v_allowance then
        raise exception 'match_quota_exceeded';
      end if;
    end if;

    update listings set state = 'confirmed' where id = v_listing.id;

  elsif m.state = 'both_confirmed' and p_next_state = 'in_transit' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

  elsif m.state = 'in_transit' and p_next_state = 'delivered' then
    if actor_role <> 'admin' then
      raise exception 'actor_not_allowed';
    end if;

  elsif m.state = 'delivered' and p_next_state = 'completed' then
    if actor_role <> 'ngo' or v_need.ngo_id is distinct from current_ngo() then
      raise exception 'actor_not_allowed';
    end if;
    update listings set state = 'completed' where id = v_listing.id;
    update needs set state = 'fulfilled' where id = v_need.id;
    perform ensure_completion_documents(m.id);

  else
    raise exception 'invalid_transition';
  end if;

  update matches
    set state = p_next_state,
        committed_at = coalesce(committed_at, case when p_next_state = 'both_confirmed' then now() end)
    where id = m.id
    returning * into m;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'match.' || p_next_state::text, m.id::text, 'customer_visible');

  return m;
end;
$$;

revoke all on function ensure_completion_documents(uuid) from public;

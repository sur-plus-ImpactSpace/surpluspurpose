-- 0061 — REQ-AUTH-01: unverified NGO needs are drafts (not allocatable).
--
-- create_need writes `draft` when the NGO is not verified; verified → `open`.
-- Ops approve (set_ngo_verification approve) promotes that NGO's drafts to open.
-- open_needs_directory / propose_match already require state = open + verified NGO.

create or replace function create_need(
  p_title text,
  p_category text,
  p_quantity int,
  p_city text,
  p_country text,
  p_target_date date default null,
  p_beneficiaries int default null,
  p_story text default null,
  p_subcategory text default null,
  p_ngo_id uuid default null
) returns needs
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  v_ngo_id uuid;
  v_state need_state;
  created needs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if actor_role <> 'ngo' and not is_ops() then
    raise exception 'actor_not_allowed';
  end if;

  v_ngo_id := case when actor_role = 'ngo' then current_ngo() else p_ngo_id end;
  if v_ngo_id is null or not exists (select 1 from ngos where id = v_ngo_id) then
    raise exception 'ngo_required';
  end if;

  if coalesce(trim(p_title), '') = '' then raise exception 'invalid_title'; end if;
  if coalesce(trim(p_category), '') = '' then raise exception 'invalid_category'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'invalid_quantity'; end if;
  if coalesce(trim(p_city), '') = '' or coalesce(trim(p_country), '') = '' then
    raise exception 'invalid_location';
  end if;
  if p_beneficiaries is not null and p_beneficiaries < 0 then
    raise exception 'invalid_beneficiaries';
  end if;

  v_state := case when ngo_is_verified(v_ngo_id) then 'open'::need_state else 'draft'::need_state end;

  insert into needs (
    ngo_id, title, category, subcategory, quantity, city, country, target_date,
    beneficiaries, state, story
  ) values (
    v_ngo_id,
    trim(p_title),
    trim(p_category),
    nullif(trim(p_subcategory), ''),
    p_quantity,
    trim(p_city),
    trim(p_country),
    p_target_date,
    coalesce(p_beneficiaries, 0),
    v_state,
    coalesce(trim(coalesce(p_story, '')), '')
  ) returning * into created;

  insert into audit_events (actor, action, target, visibility)
  values (
    auth.uid()::text,
    case when v_state = 'draft' then 'need.draft_created' else 'need.created' end,
    created.id::text,
    'customer_visible'
  );

  return created;
end;
$$;

revoke all on function create_need(text, text, int, text, text, date, int, text, text, uuid) from public;
revoke all on function create_need(text, text, int, text, text, date, int, text, text, uuid) from anon;
grant execute on function create_need(text, text, int, text, text, date, int, text, text, uuid) to authenticated;

create or replace function set_ngo_verification(
  p_ngo_id uuid,
  p_action text
) returns ngos
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  n ngos%rowtype;
  v_target ngo_verification;
  promoted int;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;
  if not is_ops() then
    raise exception 'actor_not_allowed';
  end if;

  v_target := case p_action
    when 'approve' then 'verified'
    when 'request_info' then 'pending_info'
    when 'reject' then 'rejected'
    when 'start_review' then 'review'
    else null
  end::ngo_verification;

  if v_target is null then
    raise exception 'invalid_action';
  end if;

  select * into n from ngos where id = p_ngo_id for update;
  if not found then
    raise exception 'ngo_not_found';
  end if;

  if p_action = 'approve'
     and not exists (select 1 from ngo_verification_documents where ngo_id = n.id) then
    raise exception 'verification_document_required';
  end if;

  update ngos
    set verification_state = v_target,
        verified_at = case when v_target = 'verified' then now()::date else null end
    where id = n.id
    returning * into n;

  -- Application accepted: saved drafts become marketable needs.
  if p_action = 'approve' then
    update needs
      set state = 'open'
      where ngo_id = n.id and state = 'draft';
    get diagnostics promoted = row_count;
    if promoted > 0 then
      insert into audit_events (actor, action, target, visibility)
      values (auth.uid()::text, 'need.drafts_promoted:' || promoted::text, n.id::text, 'admin_only');
    end if;
  end if;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'ngo.' || p_action, n.id::text, 'admin_only');

  return n;
end;
$$;

revoke all on function set_ngo_verification(uuid, text) from public;
grant execute on function set_ngo_verification(uuid, text) to authenticated;

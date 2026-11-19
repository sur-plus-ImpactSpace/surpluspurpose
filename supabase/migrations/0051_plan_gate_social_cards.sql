-- 0051 — Plan limits on the server: social media cards are Tree only.
--
-- The screen already offered the social-ad copilot to every corporate; the
-- server never checked plan_entitlements.social_media_cards. Now create_agent_run
-- refuses a social_ad run from a company whose plan does not include it
-- (plan_required). Matching (matches_per_year), NGO contact (RLS) and seats
-- (seat_limit_exceeded) were already enforced in the database.

CREATE OR REPLACE FUNCTION public.create_agent_run(p_task_type text, p_prompt text, p_target_type text DEFAULT NULL::text, p_target_id text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_summary text DEFAULT NULL::text, p_findings jsonb DEFAULT '[]'::jsonb, p_attachments jsonb DEFAULT '[]'::jsonb, p_document jsonb DEFAULT NULL::jsonb, p_proposed_actions jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor_role user_role;
  actor_company uuid;
  actor_ngo uuid;
  created_run agent_runs%rowtype;
  created_document documents%rowtype;
  action_value jsonb;
  action_target_type text;
  action_target_id text;
  actions_json jsonb;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  actor_company := current_company();
  actor_ngo := current_ngo();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  if p_task_type not in ('match_review', 'message_draft', 'social_ad', 'ops_summary') then
    raise exception 'invalid_task';
  end if;
  if trim(coalesce(p_prompt, '')) = '' then
    raise exception 'invalid_task';
  end if;

  -- Plan gate: social media cards are a Tree feature (plan_entitlements).
  if p_task_type = 'social_ad' and actor_role = 'corporate' and not coalesce((
      select e.social_media_cards
      from companies c join plan_entitlements e on e.plan = c.plan
      where c.id = actor_company
    ), false) then
    raise exception 'plan_required';
  end if;
  if p_target_type is not null and p_target_type not in ('match', 'listing', 'document') then
    raise exception 'invalid_target';
  end if;
  if p_task_type in ('match_review', 'message_draft') and (p_target_type <> 'match' or p_target_id is null) then
    raise exception 'invalid_target';
  end if;
  if p_target_type is not null and p_target_id is null then
    raise exception 'invalid_target';
  end if;

  if p_target_type = 'match' and not can_access_match(p_target_id) then
    raise exception 'actor_not_allowed';
  end if;
  if p_target_type = 'listing' and not exists (
    select 1
    from listings l
    where l.id::text = p_target_id
      and (actor_role = 'admin' or (actor_role = 'corporate' and l.company_id = actor_company))
  ) then
    raise exception 'actor_not_allowed';
  end if;
  if p_target_type = 'document' and not can_access_document(p_target_id) then
    raise exception 'actor_not_allowed';
  end if;
  if p_document is not null and nullif(p_document->>'matchId', '') is not null
    and not can_access_match(p_document->>'matchId') then
    raise exception 'actor_not_allowed';
  end if;

  insert into agent_runs (
    role,
    company_id,
    ngo_id,
    task_type,
    title,
    prompt,
    status,
    summary,
    findings,
    attachments
  )
  values (
    actor_role,
    case when actor_role = 'corporate' then actor_company else null end,
    case when actor_role = 'ngo' then actor_ngo else null end,
    p_task_type,
    p_title,
    trim(p_prompt),
    case when jsonb_array_length(coalesce(p_proposed_actions, '[]'::jsonb)) > 0 then 'needs_approval'::agent_run_status else 'completed'::agent_run_status end,
    p_summary,
    coalesce(p_findings, '[]'::jsonb),
    coalesce(p_attachments, '[]'::jsonb)
  )
  returning * into created_run;

  if p_document is not null then
    insert into documents (
      kind,
      title,
      status,
      company_id,
      ngo_id,
      match_id,
      storage_path,
      mime,
      size_bytes,
      created_by
    )
    values (
      (p_document->>'kind')::document_kind,
      coalesce(nullif(p_document->>'title', ''), p_title, 'Agent document'),
      coalesce(nullif(p_document->>'status', '')::document_status, 'draft'::document_status),
      case when actor_role = 'corporate' then actor_company else null end,
      case when actor_role = 'ngo' then actor_ngo else null end,
      nullif(p_document->>'matchId', '')::uuid,
      nullif(p_document->>'storagePath', ''),
      nullif(p_document->>'mime', ''),
      nullif(p_document->>'sizeBytes', '')::bigint,
      auth.uid()
    )
    returning * into created_document;

    update agent_runs
    set produced_document_id = created_document.id
    where id = created_run.id
    returning * into created_run;
  end if;

  for action_value in select value from jsonb_array_elements(coalesce(p_proposed_actions, '[]'::jsonb))
  loop
    action_target_type := nullif(action_value->>'targetType', '');
    action_target_id := nullif(action_value->>'targetId', '');
    if action_target_type = 'document' and action_target_id is null and created_document.id is not null then
      action_target_id := created_document.id::text;
    end if;

    insert into agent_proposed_actions (
      run_id,
      label,
      description,
      risk_level,
      target_type,
      target_id,
      proposed_payload
    )
    values (
      created_run.id,
      coalesce(nullif(action_value->>'label', ''), 'Review proposed action'),
      nullif(action_value->>'description', ''),
      coalesce(nullif(action_value->>'riskLevel', ''), 'medium'),
      action_target_type,
      action_target_id,
      coalesce(action_value->'proposedPayload', '{}'::jsonb)
    );
  end loop;

  perform sync_agent_run_status(created_run.id);
  select * into created_run from agent_runs where id = created_run.id;
  select coalesce(jsonb_agg(agent_action_json(a) order by a.id), '[]'::jsonb)
    into actions_json
    from agent_proposed_actions a
    where a.run_id = created_run.id;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'agent.run.created', created_run.id::text, 'admin_only');

  return jsonb_build_object(
    'run', agent_run_json(created_run),
    'actions', actions_json,
    'document', case when created_document.id is null then null else document_json(created_document) end
  );
end;
$function$;

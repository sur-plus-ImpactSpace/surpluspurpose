-- 0011_agent_listing_details.sql — richer Copilot surplus intake.
--
-- The surplus-intake CSV/XLSX now carries brand, model, year, purchase date,
-- subcategory, unit and weight (folded into subcategory / unit / weight_kg /
-- category_details by the parser). This recreates perform_agent_action (faithful
-- copy of 0009) and passes those optional fields through to create_listing when
-- executing a listing-create action, so the detail is not lost. Everything else
-- is unchanged.

create or replace function perform_agent_action(
  p_action_id text,
  p_operation text
) returns jsonb
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  actor_role user_role;
  action_row agent_proposed_actions%rowtype;
  run_row agent_runs%rowtype;
  message_body text;
  review_flag text;
  document_status text;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  actor_role := current_role_of();
  if actor_role is null then
    raise exception 'actor_not_available';
  end if;

  select * into action_row from agent_proposed_actions where id::text = p_action_id;
  if action_row.id is null then
    raise exception 'action_not_found';
  end if;

  select * into run_row from agent_runs where id = action_row.run_id;
  if run_row.id is null then
    raise exception 'action_not_found';
  end if;
  if not (
    actor_role = 'admin'
    or run_row.company_id = current_company()
    or run_row.ngo_id = current_ngo()
  ) then
    raise exception 'actor_not_allowed';
  end if;

  if p_operation = 'approve' then
    if action_row.status <> 'pending' then
      raise exception 'invalid_transition';
    end if;

    update agent_proposed_actions
    set status = 'approved', approved_by = auth.uid(), approved_at = now()
    where id = action_row.id
    returning * into action_row;
  elsif p_operation = 'reject' then
    if action_row.status in ('executed', 'rejected') then
      raise exception 'invalid_transition';
    end if;

    update agent_proposed_actions
    set status = 'rejected'
    where id = action_row.id
    returning * into action_row;
  elsif p_operation = 'execute' then
    if action_row.status <> 'approved' or action_row.approved_by is null or action_row.approved_at is null then
      raise exception 'approval_required';
    end if;

    if action_row.target_type = 'message' and action_row.target_id is not null then
      message_body := trim(coalesce(action_row.proposed_payload->>'body', ''));
      if message_body <> '' and can_access_match(action_row.target_id) then
        insert into messages (match_id, author_id, body, visibility)
        values (action_row.target_id::uuid, auth.uid(), message_body, 'customer_visible');
      end if;
    elsif action_row.target_type = 'listing' then
      if action_row.target_id is null then
        -- Copilot surplus intake: create a new listing from the proposal,
        -- including the optional detail fields.
        perform create_listing(
          action_row.proposed_payload->>'title',
          action_row.proposed_payload->>'category',
          (action_row.proposed_payload->>'quantity')::int,
          (action_row.proposed_payload->>'unitValue')::numeric,
          coalesce(action_row.proposed_payload->>'city', ''),
          coalesce(action_row.proposed_payload->>'country', ''),
          coalesce(nullif(action_row.proposed_payload->>'condition', ''), 'Good'),
          coalesce((action_row.proposed_payload->>'eligibilityUsable')::boolean, true),
          coalesce((action_row.proposed_payload->>'eligibilityPolicyFit')::boolean, true),
          coalesce((action_row.proposed_payload->>'eligibilityOwnership')::boolean, true),
          p_subcategory => nullif(action_row.proposed_payload->>'subcategory', ''),
          p_unit => nullif(action_row.proposed_payload->>'unit', ''),
          p_weight_kg => nullif(action_row.proposed_payload->>'weightKg', '')::numeric,
          p_category_details => nullif(action_row.proposed_payload->>'categoryDetails', '')
        );
      else
        review_flag := nullif(action_row.proposed_payload->>'reviewFlag', '');
        if review_flag is not null then
          update listings
          set review_flags = case
            when review_flags ? review_flag then review_flags
            else review_flags || jsonb_build_array(review_flag)
          end
          where id::text = action_row.target_id
            and (actor_role = 'admin' or (actor_role = 'corporate' and company_id = current_company()));
        end if;
      end if;
    elsif action_row.target_type = 'document' and action_row.target_id is not null then
      document_status := action_row.proposed_payload->>'status';
      if document_status in ('approved', 'published') then
        update documents
        set
          status = document_status::document_status,
          published_at = case when document_status = 'published' then now() else published_at end
        where id::text = action_row.target_id
          and can_access_document(action_row.target_id);
      end if;
    end if;

    update agent_proposed_actions
    set status = 'executed', executed_at = now()
    where id = action_row.id
    returning * into action_row;
  else
    raise exception 'invalid_operation';
  end if;

  perform sync_agent_run_status(action_row.run_id);
  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'agent.action.' || p_operation, action_row.id::text, case when p_operation = 'execute' then 'customer_visible'::visibility else 'admin_only'::visibility end);

  return agent_action_json(action_row);
end;
$$;

grant execute on function perform_agent_action(text, text) to authenticated;

-- 0050 — A company's team can remove a colleague (seat management).
--
-- Removal deletes the colleague's workspace profile (users row), which frees
-- the seat. Their login stays with Supabase Auth, so they can be invited again.
-- A users row is referenced by history (chat messages, uploaded documents,
-- approvals); those references become NULL instead of blocking the removal, so
-- the history stays and only the author link goes. (audit_events keep the actor
-- as text and are untouched.)
--
-- Nobody can remove themselves, so a company never ends up with zero members by
-- its own hand, and only members of the caller's own company are reachable.

alter table messages drop constraint messages_author_id_fkey,
  add constraint messages_author_id_fkey foreign key (author_id) references users (id) on delete set null;
alter table agent_proposed_actions drop constraint agent_proposed_actions_approved_by_fkey,
  add constraint agent_proposed_actions_approved_by_fkey foreign key (approved_by) references users (id) on delete set null;
alter table documents drop constraint documents_created_by_fkey,
  add constraint documents_created_by_fkey foreign key (created_by) references users (id) on delete set null;
alter table signature_envelopes drop constraint signature_envelopes_created_by_fkey,
  add constraint signature_envelopes_created_by_fkey foreign key (created_by) references users (id) on delete set null;
alter table ngo_verification_documents drop constraint ngo_verification_documents_uploaded_by_fkey,
  add constraint ngo_verification_documents_uploaded_by_fkey foreign key (uploaded_by) references users (id) on delete set null;
alter table company_verification_documents drop constraint company_verification_documents_uploaded_by_fkey,
  add constraint company_verification_documents_uploaded_by_fkey foreign key (uploaded_by) references users (id) on delete set null;

create or replace function remove_company_member(p_user uuid) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_company uuid;
  v_target_company uuid;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;
  if current_role_of() is distinct from 'corporate' then
    raise exception 'actor_not_allowed';
  end if;
  v_company := current_company();
  if v_company is null then
    raise exception 'actor_not_allowed';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_remove_self';
  end if;

  select company_id into v_target_company from users where id = p_user for update;
  if not found or v_target_company is distinct from v_company then
    raise exception 'member_not_found';
  end if;

  delete from users where id = p_user;

  insert into audit_events (actor, action, target, visibility)
  values (auth.uid()::text, 'member.removed', p_user::text, 'customer_visible');
end;
$$;

revoke all on function remove_company_member(uuid) from public, anon;
grant execute on function remove_company_member(uuid) to authenticated;

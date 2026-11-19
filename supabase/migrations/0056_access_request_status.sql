-- Ops follow-up on a lead from the public "Request access" form: new → invited | declined.
-- Additive; the API roles still cannot write this table (updates run server-side with the service role).
alter table public.access_requests
  add column if not exists status text not null default 'new'
    check (status in ('new', 'invited', 'declined')),
  add column if not exists handled_at timestamptz;

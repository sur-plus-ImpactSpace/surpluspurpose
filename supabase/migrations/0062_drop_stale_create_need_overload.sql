-- 0062 — Drop a remote-only create_need overload that PostgREST cannot resolve.
--
-- Production had a 12-arg variant (…, p_accepted_condition, p_postcode, p_ngo_id)
-- that is not in this repo. create or replace in 0061 added a second 10-arg
-- signature instead of replacing it, so POST /rpc/create_need returned PGRST203
-- ("Could not choose the best candidate function") → API 503 persistence_unavailable.

drop function if exists create_need(
  text, text, int, text, text, date, int, text, text, text, text, uuid
);

-- Keep grants on the remaining (repo) signature explicit.
revoke all on function create_need(text, text, int, text, text, date, int, text, text, uuid) from public;
revoke all on function create_need(text, text, int, text, text, date, int, text, text, uuid) from anon;
grant execute on function create_need(text, text, int, text, text, date, int, text, text, uuid) to authenticated;

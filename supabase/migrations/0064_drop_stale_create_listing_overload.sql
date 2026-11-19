-- 0064 — Drop a remote-only create_listing overload that PostgREST cannot resolve.
--
-- Production had a 20-arg variant (…, p_delivery_mode, p_postcode, p_company_id)
-- that is not in this repo. create or replace in 0063 replaced only the 18-arg
-- signature, so POST /rpc/create_listing returned PGRST203
-- ("Could not choose the best candidate function") → API 503 persistence_unavailable.

drop function if exists create_listing(
  text, text, int, numeric, text, text, text, boolean, boolean, boolean,
  text, text, date, text, text, numeric, text, text, text, uuid
);

-- Keep grants on the remaining (repo) signature explicit.
revoke all on function create_listing(
  text, text, int, numeric, text, text, text, boolean, boolean, boolean,
  text, text, date, text, text, numeric, text, uuid
) from public;
revoke all on function create_listing(
  text, text, int, numeric, text, text, text, boolean, boolean, boolean,
  text, text, date, text, text, numeric, text, uuid
) from anon;
grant execute on function create_listing(
  text, text, int, numeric, text, text, text, boolean, boolean, boolean,
  text, text, date, text, text, numeric, text, uuid
) to authenticated;

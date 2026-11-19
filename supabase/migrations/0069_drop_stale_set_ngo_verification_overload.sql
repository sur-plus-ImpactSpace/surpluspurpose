-- 0069 — Drop the stale 2-arg set_ngo_verification overload.
--
-- Migration 0068 added (uuid, text, date, int) via CREATE OR REPLACE, which
-- creates a *new* signature rather than replacing (uuid, text). Its DO-block
-- drop compared pg_get_function_identity_arguments to 'uuid, text', but Postgres
-- returns named args ('p_ngo_id uuid, p_action text'), so the old overload
-- stayed. PostgREST then returns PGRST203 ("Could not choose the best candidate
-- function") → API 503 persistence_unavailable on NGO approve.

drop function if exists set_ngo_verification(uuid, text);

revoke all on function set_ngo_verification(uuid, text, date, int) from public, anon;
grant execute on function set_ngo_verification(uuid, text, date, int) to authenticated;

notify pgrst, 'reload schema';

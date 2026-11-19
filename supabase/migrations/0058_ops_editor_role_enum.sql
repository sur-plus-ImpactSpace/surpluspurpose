-- 0058 — REQ-OPS-14: add `editor` to user_role.
--
-- The new value cannot be referenced in the same transaction on older Postgres
-- paths, so helpers / policy rewrites live in 0059.

alter type user_role add value if not exists 'editor';

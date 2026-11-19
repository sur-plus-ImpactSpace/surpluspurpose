-- 0040 — `failed`: delivery went wrong after shipping (ADR 0028 D4). Its own
-- migration because a new enum value cannot be used in the transaction that
-- adds it; 0041 uses it.

alter type match_state add value if not exists 'failed';

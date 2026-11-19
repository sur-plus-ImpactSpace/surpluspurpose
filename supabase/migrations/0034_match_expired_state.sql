-- 0034 — `expired`: the terminal state of a proposal nobody reacted to
-- (ADR 0028 D5). Kept in its own migration because a new enum value cannot be
-- used in the transaction that adds it; 0035 uses it.

alter type match_state add value if not exists 'expired';

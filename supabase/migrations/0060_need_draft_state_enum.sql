-- 0060 — REQ-AUTH-01: add `draft` to need_state.
-- Unverified NGOs may save needs that stay off the market until verification.
-- Behaviour (create_need / promote on approve) lives in 0061.

alter type need_state add value if not exists 'draft' before 'open';

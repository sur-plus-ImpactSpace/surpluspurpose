-- 0018 — require a fresh acceptance of the NGO Partner Agreement.
--
-- The document changed materially on 2026-07-16. Until then §5 granted only
-- "anonymised impact communications" and required prior approval for a named
-- reference; the consent checkbox was scoped to "verified corporate partners".
-- It now carries an explicit, separate, revocable consent to being named
-- publicly alongside the organisation's needs, including in marketing.
--
-- That is a change in what the signer is agreeing to, so it needs a new
-- version. Keeping 2026-07 would file two different texts under one number and
-- leave us unable to answer "what did this NGO actually agree to?" — which is
-- the only question the acceptance log exists to answer.
--
-- Effect: has_accepted_current_agreement('ngo_partner_agreement') goes false
-- for every NGO that accepted the old text, and the clickwrap reappears before
-- they can counter-sign a donation certificate again. That is intended. The
-- eight NGOs registered via Tally signed the old wording, whose own terms
-- required prior approval for a named reference — this is how they get asked.

update agreement_requirements
  set current_version = '2026-07b',
      updated_at = now()
  where kind = 'ngo_partner_agreement';

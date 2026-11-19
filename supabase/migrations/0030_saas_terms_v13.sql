-- 0030 — saas_terms 2026-08 -> 2026-09, for the pricing v13 commercial terms.
--
-- The corporate terms changed materially on 2026-08-28. Four of the five
-- changes create obligations that did not exist under 2026-08, so they cannot
-- ride along under the old version number:
--
-- 1. § 7 gains a three-month minimum term on monthly plans. Under 2026-08 a
--    customer could cancel to the end of any billing period. Tree is unlimited
--    matches, so a single month at €389 bought what the annual plan charges
--    €3,890 for. The minimum term closes that, and it binds the customer.
--
-- 2. § 3 prices a thirteenth Seed match at €290 and a coordinated pickup at
--    €390. Both were previously undefined or unlimited-and-free. Each is gated
--    on the customer confirming in text form, so neither can produce a surprise
--    invoice, but both are new payment obligations.
--
-- 3. § 3 adds the First Donation Run (€2,900 fixed, one pickup, defined scope)
--    with a four-week matching undertaking: no verified recipient, no charge.
--    Deliberately a matching undertaking and not a delivery guarantee — it
--    bites before logistics is commissioned.
--
-- 4. § 3 includes one year of Seed in every clearance project, written to END
--    after twelve months unless actively continued, with a reminder 60 days
--    before expiry. Not an auto-renewal.
--
-- 5. Transport is passed on without a mark-up (§ 3, § 7), matching what the
--    pricing page promises. The €390 coordination fee is the margin.
--
-- Effect: has_accepted_current_agreement('saas_terms') goes false for every
-- corporate that accepted 2026-08, and the clickwrap reappears before the next
-- match confirmation. That is intended — a minimum term and two new payment
-- positions are precisely what a fresh acceptance is for.
--
-- privacy_policy, ngo_partner_agreement and recipient_terms are untouched: none
-- of them changed. Bumping them would force a re-acceptance of identical text.
--
-- The terms remain a founding-phase draft pending review by counsel.

update agreement_requirements
  set current_version = '2026-09',
      updated_at = now()
  where kind = 'saas_terms';

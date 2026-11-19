-- 0029 — recipient terms, and a fresh acceptance of the corporate terms.
--
-- Three things changed in the legal documents on 2026-08-06, in preparation for
-- the Legal Clinic on 2026-08-19.
--
-- 1. saas_terms 2026-07 -> 2026-08. The corporate terms gained § 6 (clearance).
--    Until now they said sur.plus "is not offered to consumers" and stopped
--    there. Since the website opened the clearance track to private individuals,
--    a corporate releasing goods for a symbolic price is a SELLER facing a
--    CONSUMER — owing defect liability (§ 476(2) BGB: shortenable to one year,
--    not excludable), a withdrawal instruction (Art. 246a EGBGB), and possibly
--    GPSR and ElektroG duties. § 6 puts those duties on the releasing company by
--    name. That is a new obligation for the signer, not a clarification, so it
--    cannot ride along under the old version number.
--
--    Effect: has_accepted_current_agreement('saas_terms') goes false for every
--    corporate that accepted 2026-07, and the clickwrap reappears before the
--    next match confirmation. That is intended — the whole point of § 6 is that
--    the releasing company knows what it is taking on.
--
-- 2. recipient_terms is new. The receiving side never had a rulebook: the NGO
--    Partner Agreement covers one of three recipient groups and says of itself
--    that full platform terms "follow at launch". A kind with no requirement row
--    is treated as not gated (0012, fail-open), so seeding this row is what
--    turns the new document into an actual gate.
--
-- 3. privacy_policy 2026-07 -> 2026-08. The policy gained purposes that did not
--    exist before: verification evidence (Art. 9 categories for some private
--    projects), the verification fee as a payment relationship, and disclosure
--    of a recipient's invoicing details to the releasing company as a separate
--    controller. Recorded as signup metadata rather than server-enforced, so the
--    bump does not gate anything — it keeps the audit trail honest about which
--    text a given registration confirmed.
--
-- ngo_partner_agreement stays at 2026-07b: that PDF did not change, and bumping
-- it would force the registered NGOs to re-sign identical wording.
--
-- All four documents remain founding-phase drafts pending review by counsel.

update agreement_requirements
  set current_version = '2026-08',
      updated_at = now()
  where kind = 'saas_terms';

-- Deliberately an UPDATE and not an upsert: privacy_policy has no requirement
-- row today (0012 seeded only saas_terms and ngo_partner_agreement), and a row
-- with no requirement is treated as "not gated". Inserting one would silently
-- turn a signup confirmation into a hard gate on every action. If the row does
-- not exist this is a no-op, which is the intended outcome.
update agreement_requirements
  set current_version = '2026-08',
      updated_at = now()
  where kind = 'privacy_policy';

insert into agreement_requirements (kind, current_version) values
  ('recipient_terms', '2026-08')
on conflict (kind) do update
  set current_version = excluded.current_version,
      updated_at = now();

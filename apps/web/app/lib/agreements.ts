/**
 * Single source of truth for the clickwrap agreements (server-safe, no "use
 * client"). The `version` here must match the seeded `current_version` in
 * `agreement_requirements` (migration 0012) and the server enforcement in
 * `has_accepted_current_agreement`. Bumping a version means updating that row
 * and requiring a fresh acceptance.
 */
export type AgreementTerms = {
  kind: string;
  version: string;
  title: string;
  termsHref: string;
};

/**
 * termsHref pointed at "https://surpluspurpose.com" — the marketing homepage,
 * not a contract. This clickwrap gates match confirmation, so every corporate
 * confirming a match was recorded as having accepted a document that did not
 * exist. Terms never presented are not incorporated (§ 305(2) BGB), and an
 * audit trail asserting consent to nothing is worse than none. Now /terms.
 *
 * 2026-08, not 2026-07: the text changed materially. German became the
 * authoritative language, and § 6 (clearance) is new — it makes the releasing
 * company the seller in a paid transfer and puts the consumer-facing duties
 * (defect liability, withdrawal instruction, GPSR, ElektroG) on it by name.
 * That is a new obligation for the signer, not a clarification, so it needs a
 * fresh acceptance rather than a silent rewrite under the old number.
 *
 * 2026-09, not 2026-08: pricing v13 binds the signer in ways 2026-08 did not.
 * Monthly plans gain a three-month minimum term (§ 7) where cancellation was
 * previously possible to the end of any billing period; a thirteenth Seed match
 * now costs €290 and a coordinated pickup €390 (§ 3) where both were undefined
 * or unlimited. A minimum term and two new payment obligations are exactly the
 * kind of change the version field exists for, so every corporate on 2026-08
 * sees the clickwrap again before the next match confirmation. The offsetting
 * additions — the four-week matching undertaking on the First Donation Run and
 * the included Seed year that ends rather than auto-renews — are in the same
 * text, so the customer re-accepting sees what they get alongside what they owe.
 */
export const SAAS_TERMS: AgreementTerms = {
  kind: "saas_terms",
  version: "2026-09",
  title: "Allgemeine Geschäftsbedingungen",
  termsHref: "/terms"
};

/**
 * 2026-07b, not 2026-07: the document materially changed on 2026-07-16. The
 * old text granted only anonymised references and required prior approval for
 * a named one; the new text carries an explicit, revocable consent to public
 * naming including marketing. Leaving the version alone would record both
 * texts under one number — an audit trail that cannot tell who agreed to what,
 * which is exactly what the versioning is for. Bumping it requires a fresh
 * acceptance from everyone, which is the honest outcome here.
 *
 * Unchanged in 2026-08. The PDF stays what it says it is — a pre-registration
 * document for non-profits — and the general rulebook it promised ("Vollständige
 * Plattform-Nutzungsbedingungen folgen zum Launch") now exists separately as
 * RECIPIENT_TERMS. Bumping this one too would force eight NGOs to re-sign a
 * text that did not change.
 */
export const NGO_PARTNER_AGREEMENT: AgreementTerms = {
  kind: "ngo_partner_agreement",
  version: "2026-07b",
  title: "Partner Agreement",
  termsHref: "https://surpluspurpose.com/NGO_Partner_Agreement_surplus.pdf"
};

/**
 * New in 2026-08. The receiving side had no rulebook: the NGO Partner Agreement
 * covers one of three recipient groups and says of itself that it is only a
 * pre-registration document. Meanwhile the website opened receiving to small
 * businesses and private individuals through the paid clearance track — a
 * contract type the corporate terms explicitly disclaimed ("not offered to
 * consumers").
 *
 * This gates recipient activation, not match confirmation: the verification fee
 * and the consumer protections attach at admission, before any match exists.
 */
export const RECIPIENT_TERMS: AgreementTerms = {
  kind: "recipient_terms",
  version: "2026-08",
  title: "Nutzungsbedingungen für die Empfängerseite",
  termsHref: "/recipient-terms"
};

/**
 * Privacy consent captured at registration (parallel to the Tally form). Unlike
 * the two agreements above it is not server-enforced per action — it is recorded
 * as signup metadata so the confirmation is auditable from the start.
 *
 * 2026-08: the policy gained purposes that did not exist before — verification
 * evidence (including Art. 9 categories for some private projects), the
 * verification fee as a payment relationship, and the disclosure of a recipient's
 * invoicing details to the releasing company as a separate controller.
 */
export const PRIVACY_POLICY: AgreementTerms = {
  kind: "privacy_policy",
  version: "2026-08",
  title: "Datenschutzerklärung",
  termsHref: "/privacy"
};

/**
 * Not a clickwrap: the withdrawal instruction is information we owe consumers
 * under Art. 246a EGBGB, not something they agree to. It lives here so the
 * checkout and admission flows have one place to link to.
 */
export const WITHDRAWAL_INFO_HREF = "/withdrawal";

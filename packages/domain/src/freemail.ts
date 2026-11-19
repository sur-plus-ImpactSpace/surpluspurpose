/**
 * Free-mail providers a Corporate may not register with (ADR 0027 C4,
 * REQ-AUTH-03). A company must sign up with its own domain; NGOs may use
 * free mail (many small associations do) and prove eligibility by document.
 *
 * Mirror of the SQL `is_freemail_email()` (migration 0031). The database is
 * the enforcing side (claim_workspace refuses `freemail_not_allowed`); this
 * copy only lets the register form explain the rule before the round trip.
 * Keep both lists in sync.
 */
export const FREEMAIL_DOMAINS = [
  "aol.com",
  "arcor.de",
  "freenet.de",
  "gmail.com",
  "googlemail.com",
  "gmx.at",
  "gmx.ch",
  "gmx.de",
  "gmx.net",
  "gmx.com",
  "hotmail.com",
  "hotmail.de",
  "icloud.com",
  "live.com",
  "live.de",
  "mac.com",
  "mail.com",
  "mail.de",
  "me.com",
  "msn.com",
  "outlook.com",
  "outlook.de",
  "posteo.de",
  "proton.me",
  "protonmail.com",
  "t-online.de",
  "web.de",
  "yahoo.com",
  "yahoo.de",
  "yandex.com",
  "zoho.com"
] as const;

const FREEMAIL_SET: ReadonlySet<string> = new Set(FREEMAIL_DOMAINS);

/** The lower-cased domain part of an e-mail address, or null if there is none. */
export function emailDomain(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  return domain || null;
}

export function isFreemailEmail(email: string): boolean {
  const domain = emailDomain(email);
  return domain !== null && FREEMAIL_SET.has(domain);
}

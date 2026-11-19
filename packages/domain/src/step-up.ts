/**
 * Step-up authentication for tax-relevant actions (ADR 0027 C5).
 *
 * Confirming receipt of goods triggers the donation certificate, so the NGO has
 * to prove control of its email address again shortly before. The database is
 * the enforcer (recent_email_reauth(), migration 0037); this is its pure twin,
 * used by the UI to ask for the proof *before* a request is refused.
 */
export const EMAIL_REAUTH_MAX_AGE_SECONDS = 10 * 60;

/** Authentication methods that prove email ownership: an emailed link or code. */
const EMAIL_PROOF_METHODS = ["otp", "magiclink"];

/**
 * Whether an access-token `amr` claim holds an email proof no older than
 * `maxAgeSeconds`. A password or OAuth sign-in does not count, however recent.
 */
export function hasRecentEmailReauth(
  amr: unknown,
  nowSeconds: number,
  maxAgeSeconds: number = EMAIL_REAUTH_MAX_AGE_SECONDS
): boolean {
  if (!Array.isArray(amr)) return false;

  return amr.some((entry) => {
    if (typeof entry !== "object" || entry === null) return false;
    const { method, timestamp } = entry as Record<string, unknown>;

    return (
      typeof method === "string" &&
      EMAIL_PROOF_METHODS.includes(method) &&
      typeof timestamp === "number" &&
      Number.isFinite(timestamp) &&
      timestamp >= nowSeconds - maxAgeSeconds
    );
  });
}

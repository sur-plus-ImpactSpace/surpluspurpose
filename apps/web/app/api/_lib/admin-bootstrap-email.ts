/** Emails allowed to bootstrap the first admin (SURPLUS_ADMIN_BOOTSTRAP_EMAILS, comma separated). */
export function adminEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;

  return (process.env.SURPLUS_ADMIN_BOOTSTRAP_EMAILS ?? process.env.SURPLUS_ADMIN_BOOTSTRAP_EMAIL ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

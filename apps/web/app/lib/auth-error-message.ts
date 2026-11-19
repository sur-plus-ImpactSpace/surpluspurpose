import type { PanelCopy } from "../components/SmartLoginPanel";

/**
 * Turns a Supabase auth error into a clean, fully-localized message. Supabase
 * returns English, technical strings (e.g. "Invalid login credentials"); showing
 * them raw left German users with half-translated errors. We match on the stable
 * error `code` first (supabase-js v2), then fall back to substring matching on
 * the message for older/edge cases, and finally to a generic localized line —
 * we never surface the raw provider string.
 */
export type AuthErrorCopy = Pick<
  PanelCopy,
  | "emailNotConfirmed"
  | "errInvalidCredentials"
  | "errRateLimited"
  | "errUserExists"
  | "errWeakPassword"
  | "errInvalidEmail"
  | "errSamePassword"
  | "errGeneric"
>;

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

export function authErrorMessage(error: ErrorLike, copy: AuthErrorCopy): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();

  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return copy.errInvalidCredentials;
  }
  if (code === "email_not_confirmed" || message.includes("email not confirmed") || message.includes("not confirmed")) {
    return copy.emailNotConfirmed;
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    error?.status === 429 ||
    message.includes("rate limit")
  ) {
    return copy.errRateLimited;
  }
  if (
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered")
  ) {
    return copy.errUserExists;
  }
  if (code === "weak_password" || message.includes("password is too weak") || message.includes("weak password")) {
    return copy.errWeakPassword;
  }
  if (code === "validation_failed" || message.includes("valid email") || message.includes("invalid email")) {
    return copy.errInvalidEmail;
  }
  if (code === "same_password" || message.includes("should be different")) {
    return copy.errSamePassword;
  }

  return copy.errGeneric;
}

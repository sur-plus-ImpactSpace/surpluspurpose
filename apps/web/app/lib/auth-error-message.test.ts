import { describe, expect, it } from "vitest";
import { authErrorMessage, type AuthErrorCopy } from "./auth-error-message";

// Distinct sentinels so each assertion proves the exact branch was chosen.
const copy: AuthErrorCopy = {
  emailNotConfirmed: "not-confirmed",
  errInvalidCredentials: "invalid-credentials",
  errRateLimited: "rate-limited",
  errUserExists: "user-exists",
  errWeakPassword: "weak-password",
  errInvalidEmail: "invalid-email",
  errSamePassword: "same-password",
  errGeneric: "generic"
};

describe("authErrorMessage", () => {
  it("maps by stable Supabase error code", () => {
    expect(authErrorMessage({ code: "invalid_credentials" }, copy)).toBe("invalid-credentials");
    expect(authErrorMessage({ code: "email_not_confirmed" }, copy)).toBe("not-confirmed");
    expect(authErrorMessage({ code: "over_email_send_rate_limit" }, copy)).toBe("rate-limited");
    expect(authErrorMessage({ code: "user_already_exists" }, copy)).toBe("user-exists");
    expect(authErrorMessage({ code: "weak_password" }, copy)).toBe("weak-password");
    expect(authErrorMessage({ code: "validation_failed" }, copy)).toBe("invalid-email");
    expect(authErrorMessage({ code: "same_password" }, copy)).toBe("same-password");
  });

  it("falls back to message substrings when no code is present", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" }, copy)).toBe("invalid-credentials");
    expect(authErrorMessage({ message: "Email not confirmed" }, copy)).toBe("not-confirmed");
    expect(authErrorMessage({ message: "User already registered" }, copy)).toBe("user-exists");
  });

  it("treats HTTP 429 as rate limiting", () => {
    expect(authErrorMessage({ status: 429, message: "too many requests" }, copy)).toBe("rate-limited");
  });

  it("never surfaces the raw provider string — unknown errors fall back to generic", () => {
    expect(authErrorMessage({ code: "weird_new_code", message: "Some internal detail" }, copy)).toBe("generic");
    expect(authErrorMessage(null, copy)).toBe("generic");
    expect(authErrorMessage(undefined, copy)).toBe("generic");
  });
});

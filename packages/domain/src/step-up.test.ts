import { describe, expect, it } from "vitest";
import { EMAIL_REAUTH_MAX_AGE_SECONDS, hasRecentEmailReauth } from "./step-up";

const NOW = 1_800_000_000;

describe("hasRecentEmailReauth", () => {
  it("accepts a fresh email link or code", () => {
    expect(hasRecentEmailReauth([{ method: "otp", timestamp: NOW - 30 }], NOW)).toBe(true);
    expect(hasRecentEmailReauth([{ method: "magiclink", timestamp: NOW }], NOW)).toBe(true);
  });

  it("expires the proof after ten minutes", () => {
    expect(EMAIL_REAUTH_MAX_AGE_SECONDS).toBe(600);
    expect(hasRecentEmailReauth([{ method: "otp", timestamp: NOW - 600 }], NOW)).toBe(true);
    expect(hasRecentEmailReauth([{ method: "otp", timestamp: NOW - 601 }], NOW)).toBe(false);
  });

  it("does not count a password, OAuth or TOTP sign-in", () => {
    expect(hasRecentEmailReauth([{ method: "password", timestamp: NOW }], NOW)).toBe(false);
    expect(hasRecentEmailReauth([{ method: "oauth", timestamp: NOW }], NOW)).toBe(false);
    expect(hasRecentEmailReauth([{ method: "totp", timestamp: NOW }], NOW)).toBe(false);
  });

  it("finds the email proof among several methods", () => {
    expect(
      hasRecentEmailReauth(
        [
          { method: "password", timestamp: NOW - 5000 },
          { method: "otp", timestamp: NOW - 20 }
        ],
        NOW
      )
    ).toBe(true);
  });

  it("fails closed on a missing or malformed claim", () => {
    expect(hasRecentEmailReauth(undefined, NOW)).toBe(false);
    expect(hasRecentEmailReauth("otp", NOW)).toBe(false);
    expect(hasRecentEmailReauth([null, 3, { method: "otp" }, { method: "otp", timestamp: "now" }], NOW)).toBe(false);
  });
});

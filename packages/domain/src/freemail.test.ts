import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FREEMAIL_DOMAINS, emailDomain, isFreemailEmail } from "./freemail";

describe("freemail (REQ-AUTH-03)", () => {
  it("flags the common free-mail providers", () => {
    for (const email of [
      "max@gmail.com",
      "max@gmx.de",
      "max@web.de",
      "max@outlook.com",
      "max@yahoo.de",
      "max@t-online.de"
    ]) {
      expect(isFreemailEmail(email)).toBe(true);
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isFreemailEmail("  Max@GMAIL.com ")).toBe(true);
  });

  it("lets company domains through", () => {
    expect(isFreemailEmail("lea.weber@acme.de")).toBe(false);
    // A subdomain of a provider is somebody's own domain, not the provider.
    expect(isFreemailEmail("it@mail.gmail-consulting.de")).toBe(false);
  });

  it("does not treat a malformed address as free mail", () => {
    expect(isFreemailEmail("no-at-sign")).toBe(false);
    expect(emailDomain("@gmail.com")).toBeNull();
  });

  it("matches the SQL is_freemail_email() list (migration 0031)", () => {
    const sql = readFileSync(
      new URL("../../../supabase/migrations/0031_corporate_freemail_block.sql", import.meta.url),
      "utf8"
    );
    const array = sql.slice(sql.indexOf("any (array["), sql.indexOf("]::text[]"));
    const sqlDomains = [...array.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(sqlDomains).toEqual([...FREEMAIL_DOMAINS]);
  });
});

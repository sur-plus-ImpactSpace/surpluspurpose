import { describe, expect, it } from "vitest";
import { parseAccessRequestCommand } from "./access-request-api";

function headers(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));

  return { get: (name: string) => map.get(name) ?? null };
}

const withKey = headers({ "idempotency-key": "k1" });
const valid = {
  name: "Ada Lovelace",
  organization: "Analytical GmbH",
  role: "corporate",
  email: "Ada@Analytical.test",
  consent: true
};

describe("parseAccessRequestCommand", () => {
  it("requires an idempotency key and an object payload", () => {
    expect(parseAccessRequestCommand(headers(), valid)).toMatchObject({
      reason: "missing_idempotency_key",
      status: 428
    });
    expect(parseAccessRequestCommand(withKey, "nope")).toMatchObject({ reason: "invalid_payload", status: 400 });
  });

  it("validates every field", () => {
    expect(parseAccessRequestCommand(withKey, { ...valid, name: " " })).toMatchObject({ reason: "invalid_name" });
    expect(parseAccessRequestCommand(withKey, { ...valid, organization: "" })).toMatchObject({
      reason: "invalid_organization"
    });
    expect(parseAccessRequestCommand(withKey, { ...valid, role: "admin" })).toMatchObject({
      reason: "invalid_role"
    });
    expect(parseAccessRequestCommand(withKey, { ...valid, email: "nope" })).toMatchObject({
      reason: "invalid_email"
    });
    expect(parseAccessRequestCommand(withKey, { ...valid, phone: "1".repeat(51) })).toMatchObject({
      reason: "invalid_phone"
    });
    expect(parseAccessRequestCommand(withKey, { ...valid, message: "x".repeat(2001) })).toMatchObject({
      reason: "invalid_message"
    });
  });

  it("needs the privacy consent", () => {
    expect(parseAccessRequestCommand(withKey, { ...valid, consent: false })).toMatchObject({
      reason: "consent_required",
      status: 422
    });
    expect(parseAccessRequestCommand(withKey, { ...valid, consent: "true" })).toMatchObject({
      reason: "consent_required"
    });
  });

  it("normalizes a valid request", () => {
    expect(parseAccessRequestCommand(withKey, { ...valid, phone: " +49 1 ", message: "" })).toEqual({
      ok: true,
      command: {
        idempotencyKey: "k1",
        spam: false,
        input: {
          name: "Ada Lovelace",
          organization: "Analytical GmbH",
          role: "corporate",
          email: "ada@analytical.test",
          phone: "+49 1",
          message: null
        }
      }
    });
  });

  it("flags a filled honeypot as spam", () => {
    expect(parseAccessRequestCommand(withKey, { ...valid, website: "http://spam.test" })).toMatchObject({
      ok: true,
      command: { spam: true }
    });
  });
});

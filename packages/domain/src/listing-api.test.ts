import { describe, expect, it } from "vitest";
import {
  LISTING_IDEMPOTENCY_HEADER,
  parseListingCommand,
  type ListingHeaderReader
} from "./listing-api";

function headers(idempotencyKey: string | null): ListingHeaderReader {
  return { get: (name) => (name === LISTING_IDEMPOTENCY_HEADER ? idempotencyKey : null) };
}

const validBody = {
  title: "  Lenovo ThinkPad L14  ",
  category: "IT & Electronics",
  quantity: 40,
  unitValue: 120,
  city: "Munich",
  country: "Germany",
  condition: "Good",
  eligibility: { usable: true, policyFit: true, ownership: true }
};

describe("parseListingCommand", () => {
  it("accepts a valid payload and trims/normalizes fields", () => {
    const result = parseListingCommand(headers("key-1"), validBody);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.idempotencyKey).toBe("key-1");
    expect(result.command.input).toMatchObject({
      title: "Lenovo ThinkPad L14",
      category: "IT & Electronics",
      quantity: 40,
      unitValue: 120,
      city: "Munich",
      country: "Germany",
      condition: "Good",
      eligibility: { usable: true, policyFit: true, ownership: true }
    });
  });

  it("requires an idempotency key", () => {
    expect(parseListingCommand(headers(null), validBody)).toEqual({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("rejects a non-object payload", () => {
    expect(parseListingCommand(headers("key-1"), "nope")).toEqual({
      ok: false,
      reason: "invalid_payload",
      status: 400
    });
  });

  it("validates required fields", () => {
    expect(parseListingCommand(headers("key-1"), { ...validBody, title: "  " }).ok).toBe(false);
    expect(parseListingCommand(headers("key-1"), { ...validBody, quantity: 0 })).toMatchObject({
      reason: "invalid_quantity",
      status: 422
    });
    expect(parseListingCommand(headers("key-1"), { ...validBody, city: "" })).toMatchObject({
      reason: "invalid_location"
    });
    expect(parseListingCommand(headers("key-1"), { ...validBody, unitValue: -5 })).toMatchObject({
      reason: "invalid_unit_value"
    });
  });

  it("requires a complete eligibility confirmation object", () => {
    expect(
      parseListingCommand(headers("key-1"), { ...validBody, eligibility: { usable: true } })
    ).toMatchObject({ reason: "invalid_eligibility", status: 422 });
  });
});

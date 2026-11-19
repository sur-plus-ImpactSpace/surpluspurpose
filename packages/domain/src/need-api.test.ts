import { describe, expect, it } from "vitest";
import { parseNeedCommand } from "./need-api";

function headers(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));

  return { get: (name: string) => map.get(name) ?? null };
}

const validBody = {
  title: "Laptops for evening classes",
  category: "IT & Electronics",
  quantity: 20,
  city: "Munich",
  country: "Germany",
  story: "Twenty teenagers share four machines and cannot finish their applications on time.",
  targetGroup: "Evening-class participants aged 16–25",
  deliveryAddress: "Jugendzentrum West, Am Westpark 4",
  deliveryPreference: "either",
  hasVehicle: false
};

describe("parseNeedCommand", () => {
  it("requires an idempotency key", () => {
    expect(parseNeedCommand(headers(), validBody)).toMatchObject({
      ok: false,
      reason: "missing_idempotency_key",
      status: 428
    });
  });

  it("rejects a non-object payload", () => {
    expect(parseNeedCommand(headers({ "idempotency-key": "k1" }), null)).toMatchObject({
      ok: false,
      reason: "invalid_payload",
      status: 400
    });
  });

  it("validates required fields", () => {
    const withKey = headers({ "idempotency-key": "k1" });
    expect(parseNeedCommand(withKey, { ...validBody, title: " " })).toMatchObject({ reason: "invalid_title" });
    expect(parseNeedCommand(withKey, { ...validBody, category: "" })).toMatchObject({ reason: "invalid_category" });
    expect(parseNeedCommand(withKey, { ...validBody, quantity: 0 })).toMatchObject({ reason: "invalid_quantity" });
    expect(parseNeedCommand(withKey, { ...validBody, country: "" })).toMatchObject({ reason: "invalid_location" });
    expect(parseNeedCommand(withKey, { ...validBody, beneficiaries: -2 })).toMatchObject({
      reason: "invalid_beneficiaries"
    });
  });

  it("normalizes optional fields", () => {
    const result = parseNeedCommand(headers({ "idempotency-key": "k1" }), {
      ...validBody,
      urgency: "by_date",
      targetDate: "2026-11-01",
      beneficiaries: 150,
      story: "  Winter packages for families who arrive with nothing but what they carry.  "
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.idempotencyKey).toBe("k1");
    expect(result.command.input).toMatchObject({
      urgency: "by_date",
      targetDate: "2026-11-01",
      beneficiaries: 150,
      story: "Winter packages for families who arrive with nothing but what they carry."
    });
  });

  it("defaults absent optional fields", () => {
    const result = parseNeedCommand(headers({ "idempotency-key": "k1" }), validBody);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Most NGOs mean "whenever you have something" — that is flexible, and it
    // is what all four "as available"-style answers in the real data said.
    expect(result.command.input.urgency).toBe("flexible");
    expect(result.command.input.targetDate).toBeNull();
    expect(result.command.input.quantityOpen).toBe(false);
    expect(result.command.input.beneficiaries).toBeUndefined();
  });

  it("accepts a need without a quantity", () => {
    // Five of the eight real submissions had no clean number: "3-5
    // Business-Laptops", "Laptop", "Holz / Baumaterial", "Laptops"
    // (unlimited), "30+". Requiring one turned real NGOs away.
    const noQuantity: Record<string, unknown> = { ...validBody, quantityOpen: true };
    delete noQuantity.quantity;
    const result = parseNeedCommand(headers({ "idempotency-key": "k1" }), noQuantity);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.input.quantity).toBeUndefined();
    expect(result.command.input.quantityOpen).toBe(true);
  });

  it("requires a story of real substance", () => {
    const withKey = headers({ "idempotency-key": "k1" });
    // BBW's entire real answer was "Für Azubis" — true, but it tells a donor
    // nothing and carries no impact narrative.
    expect(parseNeedCommand(withKey, { ...validBody, story: "Für Azubis" })).toMatchObject({
      reason: "invalid_story",
      status: 422
    });
    expect(parseNeedCommand(withKey, { ...validBody, story: "   " })).toMatchObject({
      reason: "invalid_story"
    });
  });

  it("rejects an unknown urgency and a by_date without a date", () => {
    const withKey = headers({ "idempotency-key": "k1" });
    expect(parseNeedCommand(withKey, { ...validBody, urgency: "someday" })).toMatchObject({
      reason: "invalid_urgency"
    });
    expect(parseNeedCommand(withKey, { ...validBody, urgency: "by_date" })).toMatchObject({
      reason: "invalid_target_date"
    });
  });

  it("drops a date that no urgency asked for", () => {
    // Otherwise the UI later renders a deadline the NGO never committed to.
    const result = parseNeedCommand(headers({ "idempotency-key": "k1" }), {
      ...validBody,
      urgency: "ongoing",
      targetDate: "2026-11-01"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.input.targetDate).toBeNull();
  });

  it("requires target group and delivery address, validates logistics fields", () => {
    const withKey = headers({ "idempotency-key": "k1" });
    expect(parseNeedCommand(withKey, { ...validBody, targetGroup: " " })).toMatchObject({
      reason: "invalid_target_group"
    });
    expect(parseNeedCommand(withKey, { ...validBody, deliveryAddress: "" })).toMatchObject({
      reason: "invalid_delivery_address"
    });
    expect(parseNeedCommand(withKey, { ...validBody, deliveryPreference: "drone" })).toMatchObject({
      reason: "invalid_delivery_preference"
    });
    expect(parseNeedCommand(withKey, { ...validBody, maxQuantityPerMatch: 0 })).toMatchObject({
      reason: "invalid_max_quantity_per_match"
    });

    const result = parseNeedCommand(withKey, {
      ...validBody,
      deliveryPreference: "collect",
      maxQuantityPerMatch: 15,
      hasVehicle: true
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.command.input).toMatchObject({
      deliveryPreference: "collect",
      maxQuantityPerMatch: 15,
      hasVehicle: true
    });
  });
});

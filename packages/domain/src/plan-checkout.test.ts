import { describe, expect, it } from "vitest";
import { parsePlanCheckoutCommand } from "./plan-checkout-api";

const headers = (key: string | null = "k") => ({ get: (name: string) => (name === "idempotency-key" ? key : null) });

describe("parsePlanCheckoutCommand", () => {
  it("accepts only the paid plans", () => {
    expect(parsePlanCheckoutCommand(headers(), "c1", { plan: "seed" })).toEqual({
      ok: true,
      command: { idempotencyKey: "k", companyId: "c1", plan: "seed" }
    });
    expect(parsePlanCheckoutCommand(headers(), "c1", { plan: "tree" })).toMatchObject({ ok: true });
    expect(parsePlanCheckoutCommand(headers(), "c1", { plan: "registered" })).toMatchObject({ reason: "invalid_plan" });
    expect(parsePlanCheckoutCommand(headers(), "c1", { plan: "gold" })).toMatchObject({ reason: "invalid_plan" });
  });

  it("needs a key, a company and an object", () => {
    expect(parsePlanCheckoutCommand(headers(null), "c1", { plan: "seed" })).toMatchObject({ status: 428 });
    expect(parsePlanCheckoutCommand(headers(), " ", { plan: "seed" })).toMatchObject({ reason: "invalid_company_id" });
    expect(parsePlanCheckoutCommand(headers(), "c1", null)).toMatchObject({ reason: "invalid_payload" });
  });
});

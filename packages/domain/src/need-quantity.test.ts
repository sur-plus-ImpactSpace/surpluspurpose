import { describe, expect, it } from "vitest";
import { needQuantityLabel } from "./model";

describe("needQuantityLabel", () => {
  it("shows any quantity as a choice, not a gap", () => {
    expect(needQuantityLabel({ quantity: null, quantityOpen: true })).toBe("Any quantity");
    // An NGO that ticked "any" keeps that wording even if a number is left over.
    expect(needQuantityLabel({ quantity: 20, quantityOpen: true })).toBe("Any quantity");
  });

  it("never prints null for a need without a number", () => {
    expect(needQuantityLabel({ quantity: null, quantityOpen: false })).toBe("Quantity not stated");
    expect(needQuantityLabel({ quantity: 0, quantityOpen: false })).toBe("Quantity not stated");
  });

  it("shows the number, and what is still open once parts are taken", () => {
    expect(needQuantityLabel({ quantity: 100, quantityOpen: false })).toBe("100 units");
    expect(needQuantityLabel({ quantity: 100, quantityOpen: false }, 100)).toBe("100 units");
    expect(needQuantityLabel({ quantity: 100, quantityOpen: false }, 40)).toBe("100 units (40 still open)");
    expect(needQuantityLabel({ quantity: 100, quantityOpen: false }, null)).toBe("100 units");
  });
});

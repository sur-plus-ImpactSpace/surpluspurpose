import { describe, expect, it } from "vitest";
import { adminMfaMissing } from "./server-supabase";

describe("adminMfaMissing (REQ-NFR-03)", () => {
  it("requires aal2 for admins and fails closed on an unknown level", () => {
    expect(adminMfaMissing("admin", { aal: "aal1" })).toBe(true);
    expect(adminMfaMissing("admin", { aal: null })).toBe(true);
    expect(adminMfaMissing("admin", { aal: "aal2" })).toBe(false);
  });

  it("keeps 2FA optional for corporates and NGOs", () => {
    expect(adminMfaMissing("corporate", { aal: "aal1" })).toBe(false);
    expect(adminMfaMissing("ngo", { aal: null })).toBe(false);
  });
});

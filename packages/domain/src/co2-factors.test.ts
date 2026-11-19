import { describe, expect, it } from "vitest";
import { parseCo2FactorCommand } from "./co2-factor-api";
import { buildImpactReport } from "./impact-report";
import type { Listing, Match, Need, Ngo } from "./model";
import { createInMemoryRepository, createSeedData, type ActorContext } from "./repository";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const acme: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const headers = (key: string | null = "k") => ({ get: (name: string) => (name === "idempotency-key" ? key : null) });

describe("repository.co2Factors", () => {
  it("lets Ops set and change a factor, logging old and new value", () => {
    const repo = createInMemoryRepository(createSeedData());

    expect(repo.co2Factors.set(admin, { category: "IT", kgCo2ePerKg: 2.5 })).toMatchObject({ ok: true, factor: { category: "IT", kgCo2ePerKg: 2.5 } });
    expect(repo.co2Factors.set(admin, { category: " IT ", kgCo2ePerKg: 3.25 })).toMatchObject({ ok: true });
    expect(repo.co2Factors.list()).toHaveLength(1);
    const log = repo.auditEvents.list().filter((event) => event.action.startsWith("co2_factor.set:"));
    expect(log.map((event) => event.action).reverse()).toEqual(["co2_factor.set:none->2.5", "co2_factor.set:2.5->3.25"]);
    expect(log[0]).toMatchObject({ target: "IT", visibility: "admin_only" });
  });

  it("is Ops only and validates the value", () => {
    const repo = createInMemoryRepository(createSeedData());

    expect(repo.co2Factors.set(acme, { category: "IT", kgCo2ePerKg: 1 })).toMatchObject({ reason: "actor_not_allowed" });
    expect(repo.co2Factors.set(admin, { category: "IT", kgCo2ePerKg: -1 })).toMatchObject({ reason: "invalid_factor" });
    expect(repo.co2Factors.set(admin, { category: "IT", kgCo2ePerKg: 1001 })).toMatchObject({ reason: "invalid_factor" });
    expect(repo.co2Factors.set(admin, { category: "IT", kgCo2ePerKg: Number.NaN })).toMatchObject({ reason: "invalid_factor" });
    expect(repo.co2Factors.set(admin, { category: "  ", kgCo2ePerKg: 1 })).toMatchObject({ reason: "invalid_category" });
    expect(repo.co2Factors.list()).toEqual([]);
  });
});

describe("impact numbers follow the current CO2 table", () => {
  const listing = { id: "l1", title: "Laptops", category: "IT", quantity: 10, unitValue: 100, weightKg: 2 } as Listing;
  const other = { id: "l2", title: "Coats", category: "Textiles", quantity: 5, unitValue: 20, weightKg: 1 } as Listing;
  const need = { id: "n1", ngoId: "g1" } as Need;
  const ngo = { id: "g1", name: "Helpers", country: "DE" } as Ngo;
  const match = (id: string, listingId: string, co2Tons: number) =>
    ({ id, listingId, needId: "n1", state: "completed", quantity: 1, co2Tons, deliveryDate: "2026-03-10", createdAt: "2026-03-01T00:00:00.000Z" }) as Match;
  const matches = [match("m1", "l1", 9), match("m2", "l2", 4)];
  const report = (co2Factors: Array<{ category: string; kgCo2ePerKg: number; updatedAt: string }>) =>
    buildImpactReport({ matches, listings: [listing, other], needs: [need], ngos: [ngo], co2Factors });

  it("computes weight x factor for a category with a factor", () => {
    // 10 laptops x 2 kg = 20 kg; 20 kg x 2.5 kg CO2e/kg = 50 kg = 0.05 t
    const result = report([{ category: "IT", kgCo2ePerKg: 2.5, updatedAt: "2026-01-01" }]);

    expect(result.byCategory.find((row) => row.category === "IT")?.co2Tons).toBe(0.05);
  });

  it("falls back to the figure stored on the match where no factor is set", () => {
    const result = report([{ category: "IT", kgCo2ePerKg: 2.5, updatedAt: "2026-01-01" }]);

    expect(result.byCategory.find((row) => row.category === "Textiles")?.co2Tons).toBe(4);
    expect(result.totals.co2Tons).toBe(4.05);
  });

  it("changes when Ops edits the table", () => {
    const before = report([{ category: "IT", kgCo2ePerKg: 2.5, updatedAt: "2026-01-01" }]).totals.co2Tons;
    const after = report([{ category: "IT", kgCo2ePerKg: 10, updatedAt: "2026-02-01" }]).totals.co2Tons;

    expect(after).toBeGreaterThan(before);
    expect(after).toBe(4.2);
  });

  it("uses the stored figures with no table at all", () => {
    expect(buildImpactReport({ matches, listings: [listing, other], needs: [need], ngos: [ngo] }).totals.co2Tons).toBe(13);
  });
});

describe("parseCo2FactorCommand", () => {
  it("validates key, category and factor", () => {
    expect(parseCo2FactorCommand(headers(null), { category: "IT", kgCo2ePerKg: 1 })).toMatchObject({ status: 428 });
    expect(parseCo2FactorCommand(headers(), null)).toMatchObject({ reason: "invalid_payload" });
    expect(parseCo2FactorCommand(headers(), { category: "", kgCo2ePerKg: 1 })).toMatchObject({ reason: "invalid_category" });
    expect(parseCo2FactorCommand(headers(), { category: "IT", kgCo2ePerKg: "1" })).toMatchObject({ reason: "invalid_factor" });
    expect(parseCo2FactorCommand(headers(), { category: "IT", kgCo2ePerKg: -2 })).toMatchObject({ reason: "invalid_factor" });
    expect(parseCo2FactorCommand(headers(), { category: " IT ", kgCo2ePerKg: 0 })).toEqual({
      ok: true,
      command: { idempotencyKey: "k", category: "IT", kgCo2ePerKg: 0 }
    });
  });
});

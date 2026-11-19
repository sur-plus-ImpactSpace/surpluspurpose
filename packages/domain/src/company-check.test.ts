import { describe, expect, it } from "vitest";
import { decideCompanyCheck, isCompanyEmailDomain, parseCompanyCheckCommand, parseVatId } from "./company-check";

const headers = (key: string | null = "k") => ({ get: (name: string) => (name === "idempotency-key" ? key : null) });

describe("decideCompanyCheck", () => {
  it("approves only when VAT, domain and website all pass", () => {
    expect(decideCompanyCheck({ vatOk: true, domainOk: true, websiteOk: true })).toBe("approved");
    expect(decideCompanyCheck({ vatOk: false, domainOk: true, websiteOk: true })).toBe("manual_review");
    expect(decideCompanyCheck({ vatOk: true, domainOk: false, websiteOk: true })).toBe("manual_review");
    expect(decideCompanyCheck({ vatOk: true, domainOk: true, websiteOk: false })).toBe("manual_review");
  });
});

describe("company checks", () => {
  it("rejects freemail as a company domain", () => {
    expect(isCompanyEmailDomain("lea@acme-gmbh.de")).toBe(true);
    expect(isCompanyEmailDomain("lea@gmail.com")).toBe(false);
    expect(isCompanyEmailDomain("not-an-email")).toBe(false);
  });

  it("parses a VAT ID into country and number", () => {
    expect(parseVatId("de 123.456-789")).toEqual({ countryCode: "DE", number: "123456789", normalized: "DE123456789" });
    expect(parseVatId("123456789")).toBeNull();
    expect(parseVatId("D1")).toBeNull();
  });
});

describe("parseCompanyCheckCommand", () => {
  const body = { vatId: "DE123456789", website: "acme-gmbh.de" };

  it("requires a key, an object, a VAT ID and a website", () => {
    expect(parseCompanyCheckCommand(headers(null), "c1", body)).toMatchObject({ status: 428 });
    expect(parseCompanyCheckCommand(headers(), "c1", null)).toMatchObject({ reason: "invalid_payload" });
    expect(parseCompanyCheckCommand(headers(), "c1", { ...body, vatId: "nope" })).toMatchObject({ reason: "invalid_vat_id" });
    expect(parseCompanyCheckCommand(headers(), "c1", { ...body, website: "" })).toMatchObject({ reason: "invalid_website" });
    expect(parseCompanyCheckCommand(headers(), "c1", { ...body, website: "ftp://x.de" })).toMatchObject({ reason: "invalid_website" });
  });

  it("normalizes a valid command and adds the scheme", () => {
    expect(parseCompanyCheckCommand(headers(), " c1 ", body)).toEqual({
      ok: true,
      command: { idempotencyKey: "k", companyId: "c1", vatId: "DE123456789", website: "https://acme-gmbh.de/" }
    });
  });
});

import { createInMemoryRepository, createSeedData } from "./repository";

describe("repository.companies.recordCheck", () => {
  const pass = { vatOk: true, vatName: "NORD AB", domainOk: true, websiteOk: true, vatId: "SE123456789", website: "https://nord.se/" };

  it("verifies a company whose checks all pass, and audits it", () => {
    const repo = createInMemoryRepository(createSeedData());
    const check = repo.companies.recordCheck("co-nord", pass);

    expect(check).toMatchObject({ outcome: "approved", companyId: "co-nord" });
    expect(repo.companies.get("co-nord")).toMatchObject({ verificationState: "verified", vatId: "SE123456789" });
    expect(repo.auditEvents.list()[0]).toMatchObject({ actor: "system", action: "company.auto_verified" });
  });

  it("sends a company with any failed check to Ops", () => {
    const repo = createInMemoryRepository(createSeedData());

    expect(repo.companies.recordCheck("co-nord", { ...pass, vatOk: false })).toMatchObject({ outcome: "manual_review" });
    expect(repo.companies.get("co-nord")?.verificationState).toBe("review");
  });

  it("never auto-approves a rejected company", () => {
    const data = createSeedData();
    const nord = data.companies.find((company) => company.id === "co-nord");
    if (nord) nord.verificationState = "rejected";
    const repo = createInMemoryRepository(data);
    repo.companies.recordCheck("co-nord", pass);

    expect(repo.companies.get("co-nord")?.verificationState).toBe("rejected");
  });

  it("ignores an unknown company", () => {
    expect(createInMemoryRepository(createSeedData()).companies.recordCheck("nope", pass)).toBeUndefined();
  });
});

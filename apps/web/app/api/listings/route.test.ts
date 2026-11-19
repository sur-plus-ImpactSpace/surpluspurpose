import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const validPayload = {
  title: "Standing desks",
  category: "Office & facility furniture",
  quantity: 12,
  unitValue: 90,
  city: "Munich",
  country: "Germany",
  condition: "Good",
  eligibility: { usable: true, policyFit: true, ownership: true }
};

describe("listing create route", () => {
  it("creates an open listing for the corporate preview actor", async () => {
    const response = await POST(listingRequest(validPayload, "route-test-listing-create"));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      listing: { companyId: "co-acme", title: "Standing desks", state: "open" },
      runtime: "preview-route-handler"
    });
  });

  it("requires an idempotency key", async () => {
    const response = await POST(listingRequest(validPayload, null));
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "missing_idempotency_key" });
  });

  it("rejects when eligibility is not confirmed", async () => {
    const response = await POST(
      listingRequest(
        { ...validPayload, eligibility: { usable: true, policyFit: false, ownership: true } },
        "route-test-listing-eligibility"
      )
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "eligibility_not_confirmed" });
  });
});

function listingRequest(payload: unknown, idempotencyKey: string | null, actorId = "usr-corporate-acme") {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": actorId
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  return new NextRequest("http://127.0.0.1:3000/api/listings", {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
}

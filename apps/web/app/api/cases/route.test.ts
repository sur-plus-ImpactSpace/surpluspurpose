import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const validPayload = {
  title: "Warehouse clear-out",
  contactName: "Lea Weber",
  contactEmail: "lea@example.com",
  city: "Munich",
  country: "Germany",
  timeWindow: "Weekdays 09:00–16:00"
};

describe("donation case create route", () => {
  it("creates a case for the corporate preview actor", async () => {
    const response = await POST(caseRequest(validPayload, "route-test-case-create"));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      donationCase: { companyId: "co-acme", title: "Warehouse clear-out", step: 1 },
      runtime: "preview-route-handler"
    });
  });

  it("requires an idempotency key", async () => {
    const response = await POST(caseRequest(validPayload, null));
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "missing_idempotency_key" });
  });
});

function caseRequest(payload: unknown, idempotencyKey: string | null, actorId = "usr-corporate-acme") {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": actorId
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  return new NextRequest("http://127.0.0.1:3000/api/cases", {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
}

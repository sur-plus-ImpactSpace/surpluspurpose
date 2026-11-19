import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as createCase } from "../../route";
import { POST as addPosition } from "../positions/route";
import { POST } from "./route";

describe("donation case confirm route", () => {
  it("confirms a case with positions for the corporate preview actor", async () => {
    const created = await createCase(
      caseRequest(
        {
          title: "Confirm-route test case",
          contactName: "Lea Weber",
          contactEmail: "lea@example.com",
          city: "Munich",
          country: "Germany"
        },
        "route-test-confirm-create"
      )
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { donationCase: { id: string } };
    const caseId = createdBody.donationCase.id;

    const positioned = await addPosition(
      positionRequest(caseId, "route-test-confirm-pos"),
      { params: Promise.resolve({ caseId }) }
    );
    expect(positioned.status).toBe(201);

    const response = await POST(confirmRequest(caseId, "route-test-case-confirm"), {
      params: Promise.resolve({ caseId })
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      donationCase: { id: caseId, step: 4 },
      runtime: "preview-route-handler"
    });
  });

  it("requires an idempotency key", async () => {
    const response = await POST(confirmRequest("case-office-move", null), {
      params: Promise.resolve({ caseId: "case-office-move" })
    });
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "missing_idempotency_key" });
  });
});

function caseRequest(payload: unknown, idempotencyKey: string, actorId = "usr-corporate-acme") {
  return new NextRequest("http://127.0.0.1:3000/api/cases", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": actorId
    },
    body: JSON.stringify(payload)
  });
}

function positionRequest(caseId: string, idempotencyKey: string, actorId = "usr-corporate-acme") {
  return new NextRequest(`http://127.0.0.1:3000/api/cases/${caseId}/positions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": actorId
    },
    body: JSON.stringify({
      category: "IT & electronics",
      model: "ThinkPad L14",
      quantity: 2,
      condition: "Good",
      provenance: "Route test"
    })
  });
}

function confirmRequest(caseId: string, idempotencyKey: string | null, actorId = "usr-corporate-acme") {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": actorId
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  return new NextRequest(`http://127.0.0.1:3000/api/cases/${caseId}/confirm`, {
    method: "POST",
    headers,
    body: "{}"
  });
}

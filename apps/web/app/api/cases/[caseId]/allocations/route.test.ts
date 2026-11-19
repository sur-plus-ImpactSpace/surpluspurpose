import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as createCase } from "../../route";
import { POST as addPosition } from "../positions/route";
import { POST as confirmCase } from "../confirm/route";
import { POST } from "./route";

describe("donation allocation create route", () => {
  it("allocates on a confirmed preview case", async () => {
    const setup = await createConfirmedCase("route-alloc-ok");
    const response = await POST(
      allocateRequest(setup.caseId, "route-alloc-create", {
        positionId: setup.positionId,
        ngoId: "ngo-kleiderkammer",
        quantity: 5
      }),
      { params: Promise.resolve({ caseId: setup.caseId }) }
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      allocation: {
        positionId: setup.positionId,
        ngoId: "ngo-kleiderkammer",
        quantity: 5,
        state: "active"
      },
      runtime: "preview-route-handler"
    });
  });

  it("refuses the owning company — only Ops allocates", async () => {
    const setup = await createConfirmedCase("route-alloc-corporate");
    const response = await POST(
      allocateRequest(
        setup.caseId,
        "route-alloc-corporate-create",
        { positionId: setup.positionId, ngoId: "ngo-kleiderkammer", quantity: 1 },
        "usr-corporate-acme"
      ),
      { params: Promise.resolve({ caseId: setup.caseId }) }
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "actor_not_allowed" });
  });

  it("requires an idempotency key", async () => {
    const response = await POST(
      allocateRequest("case-office-move", null, {
        positionId: "pos-office-laptops",
        ngoId: "ngo-kleiderkammer",
        quantity: 1
      }),
      { params: Promise.resolve({ caseId: "case-office-move" }) }
    );
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "missing_idempotency_key" });
  });

  it("blocks allocation before confirm", async () => {
    const created = await createCase(
      caseRequest(
        {
          title: "Unconfirmed alloc gate",
          contactName: "Lea Weber",
          contactEmail: "lea@example.com",
          city: "Munich",
          country: "Germany"
        },
        "route-alloc-unconfirmed-case"
      )
    );
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { donationCase: { id: string } };
    const caseId = createdBody.donationCase.id;

    const positioned = await addPosition(
      positionRequest(caseId, "route-alloc-unconfirmed-pos"),
      { params: Promise.resolve({ caseId }) }
    );
    expect(positioned.status).toBe(201);
    const positionedBody = (await positioned.json()) as { position: { id: string } };

    const response = await POST(
      allocateRequest(caseId, "route-alloc-unconfirmed", {
        positionId: positionedBody.position.id,
        ngoId: "ngo-kleiderkammer",
        quantity: 1
      }),
      { params: Promise.resolve({ caseId }) }
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "case_not_confirmed" });
  });
});

async function createConfirmedCase(prefix: string) {
  const created = await createCase(
    caseRequest(
      {
        title: `Alloc route ${prefix}`,
        contactName: "Lea Weber",
        contactEmail: "lea@example.com",
        city: "Munich",
        country: "Germany"
      },
      `${prefix}-case`
    )
  );
  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as { donationCase: { id: string } };
  const caseId = createdBody.donationCase.id;

  const positioned = await addPosition(positionRequest(caseId, `${prefix}-pos`), {
    params: Promise.resolve({ caseId })
  });
  expect(positioned.status).toBe(201);
  const positionedBody = (await positioned.json()) as { position: { id: string } };

  const confirmed = await confirmCase(confirmRequest(caseId, `${prefix}-confirm`), {
    params: Promise.resolve({ caseId })
  });
  expect(confirmed.status).toBe(200);

  return { caseId, positionId: positionedBody.position.id };
}

function caseRequest(payload: unknown, idempotencyKey: string) {
  return new NextRequest("http://127.0.0.1:3000/api/cases", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": "usr-corporate-acme"
    },
    body: JSON.stringify(payload)
  });
}

function positionRequest(caseId: string, idempotencyKey: string) {
  return new NextRequest(`http://127.0.0.1:3000/api/cases/${caseId}/positions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": "usr-corporate-acme"
    },
    body: JSON.stringify({
      category: "IT & electronics",
      model: "ThinkPad L14",
      quantity: 20,
      condition: "Good",
      provenance: "Route test"
    })
  });
}

function confirmRequest(caseId: string, idempotencyKey: string) {
  return new NextRequest(`http://127.0.0.1:3000/api/cases/${caseId}/confirm`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": "usr-corporate-acme"
    },
    body: "{}"
  });
}

function allocateRequest(
  caseId: string,
  idempotencyKey: string | null,
  payload: { positionId: string; ngoId: string; quantity: number },
  // Only Ops allocates (founder decision, ADR 0037).
  actorUserId = "usr-admin-ops"
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": actorUserId
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  return new NextRequest(`http://127.0.0.1:3000/api/cases/${caseId}/allocations`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
}

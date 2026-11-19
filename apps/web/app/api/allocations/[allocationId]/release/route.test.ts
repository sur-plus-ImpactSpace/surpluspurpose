import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as createCase } from "../../../cases/route";
import { POST as addPosition } from "../../../cases/[caseId]/positions/route";
import { POST as confirmCase } from "../../../cases/[caseId]/confirm/route";
import { POST as createAllocation } from "../../../cases/[caseId]/allocations/route";
import { POST } from "./route";

describe("donation allocation release route", () => {
  it("lets the NGO release a claim in writing", async () => {
    const setup = await createConfirmedAllocation("route-release");
    const response = await POST(
      releaseRequest(setup.allocationId, "route-release-note", {
        releaseNote: "Cannot collect this week"
      }),
      { params: Promise.resolve({ allocationId: setup.allocationId }) }
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      allocation: {
        id: setup.allocationId,
        state: "released",
        releaseNote: "Cannot collect this week"
      },
      runtime: "preview-route-handler"
    });
  });

  it("requires an idempotency key and release note", async () => {
    const missingKey = await POST(
      releaseRequest("alloc-1", null, { releaseNote: "note" }),
      { params: Promise.resolve({ allocationId: "alloc-1" }) }
    );
    expect(missingKey.status).toBe(428);

    const missingNote = await POST(
      releaseRequest("alloc-1", "route-release-empty", { releaseNote: "  " }),
      { params: Promise.resolve({ allocationId: "alloc-1" }) }
    );
    expect(missingNote.status).toBe(422);
    await expect(missingNote.json()).resolves.toEqual({ error: "invalid_release_note" });
  });
});

async function createConfirmedAllocation(prefix: string) {
  const created = await createCase(
    jsonRequest("http://127.0.0.1:3000/api/cases", "usr-corporate-acme", `${prefix}-case`, {
      title: `Release route ${prefix}`,
      contactName: "Lea Weber",
      contactEmail: "lea@example.com",
      city: "Munich",
      country: "Germany"
    })
  );
  expect(created.status).toBe(201);
  const createdBody = (await created.json()) as { donationCase: { id: string } };
  const caseId = createdBody.donationCase.id;

  const positioned = await addPosition(
    jsonRequest(`http://127.0.0.1:3000/api/cases/${caseId}/positions`, "usr-corporate-acme", `${prefix}-pos`, {
      category: "IT & electronics",
      model: "ThinkPad L14",
      quantity: 20,
      condition: "Good",
      provenance: "Route test"
    }),
    { params: Promise.resolve({ caseId }) }
  );
  expect(positioned.status).toBe(201);
  const positionedBody = (await positioned.json()) as { position: { id: string } };

  const confirmed = await confirmCase(
    jsonRequest(`http://127.0.0.1:3000/api/cases/${caseId}/confirm`, "usr-corporate-acme", `${prefix}-confirm`, {}),
    { params: Promise.resolve({ caseId }) }
  );
  expect(confirmed.status).toBe(200);

  const allocated = await createAllocation(
    jsonRequest(`http://127.0.0.1:3000/api/cases/${caseId}/allocations`, "usr-admin-ops", `${prefix}-alloc`, {
      positionId: positionedBody.position.id,
      ngoId: "ngo-kleiderkammer",
      quantity: 8
    }),
    { params: Promise.resolve({ caseId }) }
  );
  expect(allocated.status).toBe(201);
  const allocatedBody = (await allocated.json()) as { allocation: { id: string } };

  return { allocationId: allocatedBody.allocation.id };
}

function jsonRequest(
  url: string,
  actorId: string,
  idempotencyKey: string,
  payload: unknown
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": actorId
    },
    body: JSON.stringify(payload)
  });
}

function releaseRequest(
  allocationId: string,
  idempotencyKey: string | null,
  payload: { releaseNote: string }
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": "usr-ngo-kleiderkammer"
  };
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  return new NextRequest(`http://127.0.0.1:3000/api/allocations/${allocationId}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
}

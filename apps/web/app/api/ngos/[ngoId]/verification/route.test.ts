import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const ADMIN_USER = "usr-admin-ops";

describe("ngo verification route", () => {
  it("requires an idempotency key", async () => {
    const response = await POST(
      verificationRequest("ngo-tafel", "approve", { idempotencyKey: null, actorId: ADMIN_USER }),
      routeContext("ngo-tafel")
    );
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "missing_idempotency_key" });
  });

  it("blocks a non-admin actor", async () => {
    // default preview actor is corporate — only Ops may verify
    const response = await POST(
      verificationRequest("ngo-tafel", "approve", { idempotencyKey: "route-test-not-allowed" }),
      routeContext("ngo-tafel")
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "actor_not_allowed" });
  });

  it("rejects an unknown action", async () => {
    const response = await POST(
      verificationRequest("ngo-tafel", "delete", {
        idempotencyKey: "route-test-invalid",
        actorId: ADMIN_USER
      }),
      routeContext("ngo-tafel")
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "invalid_action" });
  });

  it("verifies the NGO on a valid admin approval (preview)", async () => {
    const response = await POST(
      verificationRequest("ngo-tafel", "approve", {
        idempotencyKey: "route-test-approve",
        actorId: ADMIN_USER,
        // ngo-tafel is verein — REQ-NGO-06 requires notice + assessment period
        proofNoticeDate: "2024-01-15",
        proofAssessmentPeriodYears: 5
      }),
      routeContext("ngo-tafel")
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ngo: {
        id: "ngo-tafel",
        verificationState: "verified",
        proofNoticeDate: "2024-01-15",
        proofAssessmentPeriodYears: 5,
        proofValidUntil: "2029-01-15"
      },
      runtime: "preview-route-handler"
    });
  });
});

function verificationRequest(
  ngoId: string,
  action: string,
  options: {
    idempotencyKey: string | null;
    actorId?: string;
    proofNoticeDate?: string;
    proofAssessmentPeriodYears?: number;
  } = { idempotencyKey: "route-test" }
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": options.actorId ?? "usr-corporate-acme"
  };
  if (options.idempotencyKey) {
    headers["idempotency-key"] = options.idempotencyKey;
  }

  const body: Record<string, unknown> = { action };
  if (options.proofNoticeDate !== undefined) {
    body.proofNoticeDate = options.proofNoticeDate;
  }
  if (options.proofAssessmentPeriodYears !== undefined) {
    body.proofAssessmentPeriodYears = options.proofAssessmentPeriodYears;
  }

  return new NextRequest(`http://127.0.0.1:3000/api/ngos/${ngoId}/verification`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

function routeContext(ngoId: string) {
  return {
    params: Promise.resolve({
      ngoId
    })
  };
}

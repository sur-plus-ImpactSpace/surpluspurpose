import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("invitation create route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates preview invitations with idempotency and a fallback acceptance link", async () => {
    vi.stubEnv("SURPLUS_ROUTE_RUNTIME", "");

    const response = await POST(
      invitationRequest({
        email: `ops-${Date.now()}@acme.example`,
        idempotencyKey: `invite-preview-${Date.now()}`
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      acceptanceUrl: expect.stringContaining("?invite="),
      delivery: {
        provider: "not_configured",
        reason: "email_provider_not_configured",
        status: "skipped"
      },
      deliveryAudit: {
        status: "recorded"
      },
      invitation: {
        role: "corporate",
        companyId: "co-acme",
        orgName: "Acme GmbH",
        status: "pending"
      },
      runtime: "preview-route-handler"
    });
  });

  it("requires an idempotency key before creating an invitation", async () => {
    const response = await POST(invitationRequest({ idempotencyKey: null }));

    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({
      error: "missing_idempotency_key"
    });
  });
});

function invitationRequest({
  email = "ops@acme.example",
  idempotencyKey = "invite-preview-001"
}: {
  email?: string;
  idempotencyKey?: string | null;
} = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    "x-surplus-preview-user-id": "usr-corporate-acme"
  });
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

  return new NextRequest("http://127.0.0.1:3000/api/invitations", {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      role: "corporate",
      companyId: "co-acme",
      orgName: "Acme GmbH",
      expiresAt: "2026-07-15"
    })
  });
}

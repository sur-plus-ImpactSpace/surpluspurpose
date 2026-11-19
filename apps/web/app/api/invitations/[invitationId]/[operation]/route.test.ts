import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as createInvitation } from "../../route";
import { POST as mutateInvitation } from "./route";

describe("invitation mutation route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("revokes pending preview invitations through the route boundary", async () => {
    const email = `revoke-${Date.now()}@ngo.example`;
    const createResponse = await createInvitation(
      invitationCreateRequest({
        email,
        idempotencyKey: `invite-create-${Date.now()}`
      })
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      invitation: {
        id: string;
      };
    };

    const response = await mutateInvitation(
      invitationMutationRequest({ idempotencyKey: `invite-revoke-${Date.now()}` }),
      routeContext({
        invitationId: created.invitation.id,
        operation: "revoke"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      invitation: {
        id: created.invitation.id,
        status: "revoked"
      },
      runtime: "preview-route-handler"
    });
  });

  it("resends pending preview invitations with a rotated fallback link", async () => {
    const email = `resend-${Date.now()}@ngo.example`;
    const createResponse = await createInvitation(
      invitationCreateRequest({
        email,
        idempotencyKey: `invite-create-resend-${Date.now()}`
      })
    );
    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      invitation: {
        id: string;
      };
    };

    const response = await mutateInvitation(
      invitationMutationRequest({ idempotencyKey: `invite-resend-${Date.now()}` }),
      routeContext({
        invitationId: created.invitation.id,
        operation: "resend"
      })
    );

    expect(response.status).toBe(200);
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
        id: created.invitation.id,
        status: "pending"
      },
      runtime: "preview-route-handler"
    });
  });

  it("requires an idempotency key before mutating invitations", async () => {
    const response = await mutateInvitation(
      invitationMutationRequest({ idempotencyKey: null }),
      routeContext({
        invitationId: "inv-acme-ops",
        operation: "revoke"
      })
    );

    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({
      error: "missing_idempotency_key"
    });
  });
});

function invitationCreateRequest({
  email,
  idempotencyKey
}: {
  email: string;
  idempotencyKey: string;
}) {
  return new NextRequest("http://127.0.0.1:3000/api/invitations", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": "usr-admin-ops"
    }),
    body: JSON.stringify({
      email,
      role: "ngo",
      ngoId: "ngo-kleiderkammer",
      orgName: "Kleiderkammer Berlin",
      expiresAt: "2026-07-15"
    })
  });
}

function invitationMutationRequest({
  idempotencyKey
}: {
  idempotencyKey: string | null;
}) {
  const headers = new Headers({
    "x-surplus-preview-user-id": "usr-admin-ops"
  });
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

  return new NextRequest("http://127.0.0.1:3000/api/invitations/inv-acme-ops/revoke", {
    method: "POST",
    headers
  });
}

function routeContext(params: { invitationId: string; operation: string }) {
  return {
    params: Promise.resolve(params)
  };
}

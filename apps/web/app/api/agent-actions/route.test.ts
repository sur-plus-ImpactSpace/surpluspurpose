import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./[actionId]/[operation]/route";

describe("agent action route", () => {
  it("rejects unknown preview user ids instead of falling back to the default actor", async () => {
    const response = await POST(
      previewRequest("act-draft-ngo-message", "approve", "usr-unknown", "route-test-unknown-user"),
      routeContext("act-draft-ngo-message", "approve")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "actor_not_available"
    });
  });

  it("keeps preview approval state across approve and execute requests", async () => {
    const actionId = "act-draft-ngo-message";
    const actorId = "usr-corporate-acme";

    const approval = await POST(
      previewRequest(actionId, "approve", actorId, "route-test-approve"),
      routeContext(actionId, "approve")
    );
    expect(approval.status).toBe(200);
    await expect(approval.json()).resolves.toMatchObject({
      action: {
        id: actionId,
        status: "approved"
      },
      runtime: "preview-route-handler"
    });

    const execution = await POST(
      previewRequest(actionId, "execute", actorId, "route-test-execute"),
      routeContext(actionId, "execute")
    );
    expect(execution.status).toBe(200);
    await expect(execution.json()).resolves.toMatchObject({
      action: {
        id: actionId,
        status: "executed"
      },
      runtime: "preview-route-handler"
    });
  });
});

function previewRequest(
  actionId: string,
  operation: "approve" | "execute" | "reject",
  actorId: string,
  idempotencyKey: string
) {
  return new NextRequest(`http://127.0.0.1:3000/api/agent-actions/${actionId}/${operation}`, {
    method: "POST",
    headers: {
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": actorId
    }
  });
}

function routeContext(actionId: string, operation: "approve" | "execute" | "reject") {
  return {
    params: Promise.resolve({
      actionId,
      operation
    })
  };
}

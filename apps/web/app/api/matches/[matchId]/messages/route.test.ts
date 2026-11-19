import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

describe("match message route", () => {
  it("persists preview messages across POST and GET requests", async () => {
    const body = "Can Florian confirm the logistics window from the service thread?";

    const created = await POST(
      previewMessageRequest("mat-thinkpads", body, "route-test-message-create"),
      routeContext("mat-thinkpads")
    );
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toMatchObject({
      message: {
        matchId: "mat-thinkpads",
        authorId: "usr-corporate-acme",
        body,
        visibility: "customer_visible"
      },
      runtime: "preview-route-handler"
    });

    const listed = await GET(previewReadRequest("mat-thinkpads"), routeContext("mat-thinkpads"));
    expect(listed.status).toBe(200);
    const payload = (await listed.json()) as { messages: Array<{ body: string }> };
    expect(payload.messages.some((message) => message.body === body)).toBe(true);
  });

  it("rejects unknown preview user ids before creating messages", async () => {
    const response = await POST(
      previewMessageRequest("mat-thinkpads", "This must not be sent.", "route-test-message-unknown", "usr-unknown"),
      routeContext("mat-thinkpads")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "actor_not_available"
    });
  });
});

function previewMessageRequest(
  matchId: string,
  body: string,
  idempotencyKey: string,
  actorId = "usr-corporate-acme"
) {
  return new NextRequest(`http://127.0.0.1:3000/api/matches/${matchId}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      "x-surplus-preview-user-id": actorId
    },
    body: JSON.stringify({ body })
  });
}

function previewReadRequest(matchId: string, actorId = "usr-corporate-acme") {
  return new NextRequest(`http://127.0.0.1:3000/api/matches/${matchId}/messages`, {
    method: "GET",
    headers: {
      "x-surplus-preview-user-id": actorId
    }
  });
}

function routeContext(matchId: string) {
  return {
    params: Promise.resolve({
      matchId
    })
  };
}

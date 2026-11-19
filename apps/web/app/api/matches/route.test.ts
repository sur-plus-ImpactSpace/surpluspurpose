import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const ADMIN_USER = "usr-admin-ops";

describe("match proposal route", () => {
  it("requires an idempotency key", async () => {
    const response = await POST(
      proposalRequest({ listingId: "lst-standing-desks", needId: "need-study-desks" }, { idempotencyKey: null })
    );
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "missing_idempotency_key" });
  });

  it("rejects a malformed payload", async () => {
    const response = await POST(proposalRequest({ listingId: "lst-standing-desks" }, { idempotencyKey: "p-bad" }));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "invalid_need_id" });
  });

  it("blocks a non-admin actor", async () => {
    // default preview actor is the corporate user
    const response = await POST(
      proposalRequest(
        { listingId: "lst-standing-desks", needId: "need-study-desks" },
        { idempotencyKey: "p-corporate" }
      )
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "actor_not_allowed" });
  });

  it("reports unknown listings and needs", async () => {
    const unknownListing = await POST(
      proposalRequest(
        { listingId: "lst-nope", needId: "need-study-desks" },
        { idempotencyKey: "p-no-listing", actorId: ADMIN_USER }
      )
    );
    expect(unknownListing.status).toBe(404);
    await expect(unknownListing.json()).resolves.toEqual({ error: "listing_not_found" });
  });

  it("refuses a listing that is already matched", async () => {
    const response = await POST(
      proposalRequest(
        { listingId: "lst-thinkpads", needId: "need-study-desks" },
        { idempotencyKey: "p-taken", actorId: ADMIN_USER }
      )
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "listing_not_open" });
  });

  it("refuses a part larger than the need still wants", async () => {
    // need-study-desks wants 24; lst-standing-desks offers 48.
    const response = await POST(
      proposalRequest(
        { listingId: "lst-standing-desks", needId: "need-study-desks", quantity: 30 },
        { idempotencyKey: "p-too-many", actorId: ADMIN_USER }
      )
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "quantity_exceeds_open" });
  });

  it("rejects a quantity that is not a positive whole number", async () => {
    const response = await POST(
      proposalRequest(
        { listingId: "lst-standing-desks", needId: "need-study-desks", quantity: 1.5 },
        { idempotencyKey: "p-fraction", actorId: ADMIN_USER }
      )
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "invalid_quantity" });
  });

  it("creates a proposed match for an admin (preview)", async () => {
    const response = await POST(
      proposalRequest(
        { listingId: "lst-standing-desks", needId: "need-study-desks" },
        { idempotencyKey: "p-ok", actorId: ADMIN_USER }
      )
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      // The default part is what the need still wants (24 of the listing's 48).
      match: { listingId: "lst-standing-desks", needId: "need-study-desks", state: "proposed", quantity: 24 },
      runtime: "preview-route-handler"
    });
  });
});

function proposalRequest(
  body: unknown,
  options: { idempotencyKey: string | null; actorId?: string } = { idempotencyKey: "route-test" }
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": options.actorId ?? "usr-corporate-acme"
  };
  if (options.idempotencyKey) {
    headers["idempotency-key"] = options.idempotencyKey;
  }

  return new NextRequest("http://127.0.0.1:3000/api/matches", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

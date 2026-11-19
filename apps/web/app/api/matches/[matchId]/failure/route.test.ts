import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const ADMIN_USER = "usr-admin-ops";

function failureRequest(matchId: string, body: unknown, options: { key?: string | null; actorId?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": options.actorId ?? "usr-corporate-acme"
  };
  if (options.key !== null) headers["idempotency-key"] = options.key ?? "f-1";

  return new NextRequest(`http://127.0.0.1:3000/api/matches/${matchId}/failure`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

const context = (matchId: string) => ({ params: Promise.resolve({ matchId }) });

describe("match failure route", () => {
  it("requires an idempotency key and a fault decision", async () => {
    expect((await POST(failureRequest("mat-jackets", { ngoAtFault: true }, { key: null }), context("mat-jackets"))).status).toBe(428);
    const response = await POST(failureRequest("mat-jackets", {}, { key: "f-nofault", actorId: ADMIN_USER }), context("mat-jackets"));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "invalid_fault" });
  });

  it("blocks a non-admin actor", async () => {
    const response = await POST(failureRequest("mat-jackets", { ngoAtFault: false }, { key: "f-corp" }), context("mat-jackets"));
    expect(response.status).toBe(403);
  });

  it("refuses a match that has not shipped (cancel it instead)", async () => {
    // mat-jackets is both_confirmed in the seed.
    const response = await POST(
      failureRequest("mat-jackets", { ngoAtFault: false }, { key: "f-early", actorId: ADMIN_USER }),
      context("mat-jackets")
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "not_shipped" });
  });
});

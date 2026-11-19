import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const ctx = (userId: string) => ({ params: Promise.resolve({ userId }) });
const req = (userId: string, key: string | null, actor = "usr-corporate-acme") =>
  new NextRequest(`http://127.0.0.1:3000/api/members/${userId}/remove`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-surplus-preview-user-id": actor, ...(key ? { "idempotency-key": key } : {}) },
    body: "{}"
  });

describe("member removal route", () => {
  it("needs an idempotency key", async () => {
    expect((await POST(req("usr-x", null), ctx("usr-x"))).status).toBe(428);
  });

  it("refuses to remove yourself", async () => {
    const response = await POST(req("usr-corporate-acme", "m-self"), ctx("usr-corporate-acme"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "cannot_remove_self" });
  });

  it("does not find a user outside the company", async () => {
    expect((await POST(req("usr-ngo-kleiderkammer", "m-ngo"), ctx("usr-ngo-kleiderkammer"))).status).toBe(404);
  });

  it("blocks an NGO actor", async () => {
    expect((await POST(req("usr-corporate-acme", "m-ngo-actor", "usr-ngo-kleiderkammer"), ctx("usr-corporate-acme"))).status).toBe(403);
  });
});

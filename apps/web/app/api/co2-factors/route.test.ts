import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown, key: string | null, actor = "usr-admin-ops") =>
  POST(
    new NextRequest("http://127.0.0.1:3000/api/co2-factors", {
      method: "POST",
      headers: { "content-type": "application/json", "x-surplus-preview-user-id": actor, ...(key ? { "idempotency-key": key } : {}) },
      body: JSON.stringify(body)
    })
  );

describe("CO2 factor route", () => {
  it("needs a key and a valid factor", async () => {
    expect((await post({ category: "IT", kgCo2ePerKg: 2 }, null)).status).toBe(428);
    const bad = await post({ category: "IT", kgCo2ePerKg: -1 }, "co2-bad");
    expect(bad.status).toBe(422);
    await expect(bad.json()).resolves.toEqual({ error: "invalid_factor" });
  });

  it("is for Ops only", async () => {
    expect((await post({ category: "IT", kgCo2ePerKg: 2 }, "co2-corp", "usr-corporate-acme")).status).toBe(403);
    expect((await post({ category: "IT", kgCo2ePerKg: 2 }, "co2-ngo", "usr-ngo-kleiderkammer")).status).toBe(403);
  });

  it("stores the factor for Ops (preview)", async () => {
    const response = await post({ category: "IT Hardware", kgCo2ePerKg: 4.2 }, "co2-ok");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ category: "IT Hardware", kgCo2ePerKg: 4.2, runtime: "preview" });
  });
});

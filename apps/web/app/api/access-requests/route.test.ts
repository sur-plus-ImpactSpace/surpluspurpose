import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const valid = {
  name: "Ada Lovelace",
  organization: "Analytical GmbH",
  role: "corporate",
  email: "ada@analytical.test",
  consent: true
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("access request route", () => {
  it("requires an idempotency key", async () => {
    const response = await POST(accessRequest(valid, { idempotencyKey: null, ip: "10.0.0.1" }));
    expect(response.status).toBe(428);
  });

  it("rejects an invalid or unconsented form", async () => {
    const badEmail = await POST(accessRequest({ ...valid, email: "nope" }, { ip: "10.0.0.2" }));
    expect(badEmail.status).toBe(422);
    await expect(badEmail.json()).resolves.toEqual({ error: "invalid_email" });

    const noConsent = await POST(accessRequest({ ...valid, consent: false }, { ip: "10.0.0.2" }));
    await expect(noConsent.json()).resolves.toEqual({ error: "consent_required" });
  });

  it("accepts a request without a session (preview)", async () => {
    const response = await POST(accessRequest(valid, { ip: "10.0.0.3" }));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("answers a honeypot hit like a success and stores nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");

    const response = await POST(accessRequest({ ...valid, website: "http://spam.test" }, { ip: "10.0.0.4" }));
    expect(response.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores through the RPC with the anon key only (supabase)", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");

    const response = await POST(accessRequest(valid, { ip: "10.0.0.5", authorization: "Bearer someone-elses" }));
    expect(response.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("http://127.0.0.1:54321/rest/v1/rpc/submit_access_request");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer anon");
    expect(JSON.parse(String(init.body))).toMatchObject({ p_email: "ada@analytical.test", p_role: "corporate" });
  });

  it("reports an unavailable database without leaking details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon");

    const response = await POST(accessRequest(valid, { ip: "10.0.0.6" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "persistence_unavailable" });
  });

  it("rate-limits one address", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 40; attempt += 1) {
      statuses.push((await POST(accessRequest(valid, { ip: "10.9.9.9" }))).status);
    }

    expect(statuses).toContain(429);
  });
});

function accessRequest(
  body: unknown,
  options: { idempotencyKey?: string | null; ip: string; authorization?: string }
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": options.ip
  };
  if (options.idempotencyKey !== null) headers["idempotency-key"] = options.idempotencyKey ?? "form-1";
  if (options.authorization) headers.authorization = options.authorization;

  return new NextRequest("http://127.0.0.1:3000/api/access-requests", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

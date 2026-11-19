import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const ctx = (companyId: string) => ({ params: Promise.resolve({ companyId }) });

function checkRequest(companyId: string, body: unknown, key: string | null = "k", actorId = "usr-corporate-acme") {
  const headers: Record<string, string> = { "content-type": "application/json", "x-surplus-preview-user-id": actorId };
  if (key) headers["idempotency-key"] = key;

  return new NextRequest(`http://127.0.0.1:3000/api/companies/${companyId}/auto-check`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("company auto-check route", () => {
  it("requires an idempotency key and valid details", async () => {
    expect((await POST(checkRequest("co-nord", {}, null), ctx("co-nord"))).status).toBe(428);
    const bad = await POST(checkRequest("co-nord", { vatId: "x", website: "y" }, "k1"), ctx("co-nord"));
    expect(bad.status).toBe(422);
  });

  it("only lets a company check itself", async () => {
    const response = await POST(
      checkRequest("co-nord", { vatId: "DE123456789", website: "acme.de" }, "k2"),
      ctx("co-nord")
    );
    // the preview actor belongs to co-acme, not co-nord
    expect(response.status).toBe(403);
  });

  it("does not re-check an already verified company", async () => {
    const response = await POST(
      checkRequest("co-acme", { vatId: "DE123456789", website: "acme.de" }, "k3"),
      ctx("co-acme")
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "already_verified" });
  });
});

describe("company auto-check route, supabase runtime", () => {
  it("writes the result with the service role, never with the user's token", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const calls: Array<{ url: string; auth: string | null }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, auth: new Headers(init?.headers).get("authorization") });
        if (url.includes("/auth/v1/user")) return Response.json({ id: "usr-c" });
        if (url.includes("/rest/v1/users")) {
          return Response.json([
            { id: "usr-c", email: "lea@acme-gmbh.de", full_name: "Lea", role: "corporate", company_id: "cmp-1", ngo_id: null, created_at: "2026-06-24T10:00:00.000Z" }
          ]);
        }
        if (url.includes("/rest/v1/companies")) {
          return Response.json([
            { id: "cmp-1", name: "Acme", plan: "registered", city: null, country: null, owner_name: null, contact_email: null, reporting_email: null, status: "onboarding", verification_state: "onboarding", verified_at: null, vat_id: null, website: null, created_at: "2026-06-24T10:00:00.000Z" }
          ]);
        }
        if (url.includes("/vies/")) return Response.json({ isValid: true, name: "ACME" });
        if (url.includes("/rpc/record_company_check")) return new Response(null, { status: 204 });
        if (url.includes("/rest/v1/")) return Response.json([]);

        return new Response("ok", { status: 200 });
      })
    );

    const request = new NextRequest("http://127.0.0.1:3000/api/companies/cmp-1/auto-check", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer user-jwt", "idempotency-key": "k-svc" },
      body: JSON.stringify({ vatId: "DE123456789", website: "https://93.184.216.34" })
    });
    const response = await POST(request, ctx("cmp-1"));

    expect(response.status).toBe(200);
    const rpc = calls.find((call) => call.url.includes("/rpc/record_company_check"));
    expect(rpc?.auth).toBe("Bearer service-key");
    vi.unstubAllEnvs();
  });
});

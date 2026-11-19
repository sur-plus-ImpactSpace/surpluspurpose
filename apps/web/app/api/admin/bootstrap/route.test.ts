import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("admin bootstrap route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires the bootstrap token before touching Supabase", async () => {
    vi.stubEnv("SURPLUS_ADMIN_BOOTSTRAP_TOKEN", "bootstrap-secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(bootstrapRequest({ bootstrapToken: null }));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "bootstrap_token_required"
    });
  });

  it("rejects signed-in users outside the bootstrap email allowlist", async () => {
    bootstrapEnv();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          id: "usr-admin",
          email: "other@example.org"
        })
      )
    );

    const response = await POST(bootstrapRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "bootstrap_email_not_allowed"
    });
  });

  it("creates an admin user with the service role after auth and allowlist checks", async () => {
    bootstrapEnv();
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = new Headers(init?.headers);
        calls.push(`${init?.method ?? "GET"} ${url.pathname}:${headers.get("apikey")}:${headers.get("authorization")}`);

        if (url.pathname === "/auth/v1/user") {
          return Response.json({
            id: "usr-admin",
            email: "florian@sur.plus"
          });
        }
        if (url.pathname === "/rest/v1/users" && !init?.method) {
          return Response.json([]);
        }
        if (url.pathname === "/rest/v1/users") {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            email: "florian@sur.plus",
            full_name: "Florian",
            id: "usr-admin",
            role: "admin"
          });

          return Response.json([
            {
              id: "usr-admin",
              email: "florian@sur.plus",
              full_name: "Florian",
              role: "admin",
              company_id: null,
              ngo_id: null,
              created_at: "2026-06-26T10:00:00.000Z"
            }
          ]);
        }

        return Response.json([]);
      })
    );

    const response = await POST(bootstrapRequest({ body: { fullName: "Florian" } }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      runtime: "service-role-bootstrap",
      state: "created",
      user: {
        email: "florian@sur.plus",
        role: "admin"
      }
    });
    // The shared rate limiter also talks to Supabase; this test is about the bootstrap calls.
    expect(calls.filter((call) => !call.includes("reserve_rate_limit"))).toEqual([
      "GET /auth/v1/user:anon-key:Bearer user-jwt",
      "GET /rest/v1/users:service-key:Bearer service-key",
      "POST /rest/v1/users:service-key:Bearer service-key",
      "POST /rest/v1/audit_events:service-key:Bearer service-key"
    ]);
  });
});

function bootstrapEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  vi.stubEnv("SURPLUS_ADMIN_BOOTSTRAP_EMAIL", "florian@sur.plus");
  vi.stubEnv("SURPLUS_ADMIN_BOOTSTRAP_TOKEN", "bootstrap-secret");
}

function bootstrapRequest({
  body = {},
  bootstrapToken = "bootstrap-secret"
}: {
  body?: Record<string, unknown>;
  bootstrapToken?: string | null;
} = {}) {
  const headers = new Headers({
    authorization: "Bearer user-jwt",
    "content-type": "application/json"
  });
  if (bootstrapToken) headers.set("x-surplus-bootstrap-token", bootstrapToken);

  return new NextRequest("http://127.0.0.1:3000/api/admin/bootstrap", {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

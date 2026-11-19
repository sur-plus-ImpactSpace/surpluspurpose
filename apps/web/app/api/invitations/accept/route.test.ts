import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

describe("invitation acceptance route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("requires a signed-in Supabase user", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    const response = await POST(acceptRequest({ authorization: null }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "auth_required"
    });
  });

  it("provisions the authenticated user through the accept_invitation RPC", async () => {
    const calls: string[] = [];
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = new Headers(init?.headers);
        calls.push(`${url.pathname}:${headers.get("apikey")}:${headers.get("authorization")}`);

        if (url.pathname === "/auth/v1/user") {
          return Response.json({
            id: "usr-new-member",
            email: "ops@acme.example"
          });
        }

        expect(url.pathname).toBe("/rest/v1/rpc/accept_invitation");
        expect(JSON.parse(String(init?.body))).toEqual({
          p_acceptance_token: "a".repeat(43),
          p_full_name: null
        });

        return Response.json({
          id: "usr-new-member",
          email: "ops@acme.example",
          full_name: "Lena Ops",
          role: "corporate",
          company_id: "cmp-acme",
          ngo_id: null,
          created_at: "2026-06-26T10:00:00.000Z"
        });
      })
    );

    const response = await POST(acceptRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      runtime: "supabase-rpc",
      user: {
        id: "usr-new-member",
        role: "corporate",
        companyId: "cmp-acme"
      }
    });
    expect(calls).toEqual([
      "/auth/v1/user:anon-key:Bearer invitee-jwt",
      "/rest/v1/rpc/accept_invitation:anon-key:Bearer invitee-jwt"
    ]);
  });

  it("maps invalid invitation tokens without provisioning a user", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        if (url.pathname === "/auth/v1/user") {
          return Response.json({
            id: "usr-new-member",
            email: "ops@acme.example"
          });
        }

        return Response.json({ message: "invalid_invitation_token" }, { status: 400 });
      })
    );

    const response = await POST(acceptRequest());

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_invitation_token"
    });
  });
});

function acceptRequest({
  authorization = "Bearer invitee-jwt"
}: {
  authorization?: string | null;
} = {}) {
  const headers = new Headers({
    "content-type": "application/json"
  });
  if (authorization) headers.set("authorization", authorization);

  return new NextRequest("http://127.0.0.1:3000/api/invitations/accept", {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: "a".repeat(43)
    })
  });
}

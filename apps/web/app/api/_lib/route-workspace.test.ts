import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { bearerAssuranceLevel, loadRouteWorkspace } from "./route-workspace";

describe("loadRouteWorkspace Supabase auth boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("resolves the route actor from the authenticated Supabase user id", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", supabaseFetchMock("usr-corporate-acme"));

    const decision = await loadRouteWorkspace(authenticatedRequest());

    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.workspace.actor).toEqual({
        role: "corporate",
        userId: "usr-corporate-acme",
        companyId: "cmp-acme"
      });
    }
  });

  it("rejects valid auth sessions that do not have a provisioned workspace profile", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", supabaseFetchMock("usr-missing"));

    const decision = await loadRouteWorkspace(authenticatedRequest());

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.response.status).toBe(401);
      await expect(decision.response.json()).resolves.toEqual({
        error: "actor_not_available"
      });
    }
  });

  it("rejects invalid bearer tokens before loading workspace data", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("/auth/v1/user")) {
        return Response.json({ message: "JWT expired" }, { status: 401 });
      }

      return Response.json([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const decision = await loadRouteWorkspace(authenticatedRequest());

    expect(decision.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    if (!decision.ok) {
      expect(decision.response.status).toBe(401);
      await expect(decision.response.json()).resolves.toEqual({
        error: "auth_required"
      });
    }
  });
});

describe("loadRouteWorkspace admin 2FA gate (REQ-NFR-03)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("refuses an admin session below aal2", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", adminFetchMock());

    const decision = await loadRouteWorkspace(requestWithToken(jwtWithClaims({ aal: "aal1" })));

    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.response.status).toBe(403);
      await expect(decision.response.json()).resolves.toEqual({ error: "mfa_required" });
    }
  });

  it("lets an admin at aal2 through", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal("fetch", adminFetchMock());

    const decision = await loadRouteWorkspace(requestWithToken(jwtWithClaims({ aal: "aal2" })));

    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.workspace.actor).toEqual({ role: "admin", userId: "usr-admin" });
  });

  it("reads the aal claim from a bearer token and fails closed on garbage", () => {
    expect(bearerAssuranceLevel(`Bearer ${jwtWithClaims({ aal: "aal2" })}`)).toBe("aal2");
    expect(bearerAssuranceLevel(`Bearer ${jwtWithClaims({})}`)).toBeNull();
    expect(bearerAssuranceLevel("Bearer not-a-jwt")).toBeNull();
    expect(bearerAssuranceLevel(undefined)).toBeNull();
  });
});

function jwtWithClaims(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "usr-admin", ...claims })}.signature`;
}

function requestWithToken(token: string) {
  return new NextRequest("http://127.0.0.1:3000/api/matches/mat-thinkpads/transition", {
    headers: { authorization: `Bearer ${token}` }
  });
}

function adminFetchMock() {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) {
      return Response.json({ id: "usr-admin", email: "ops@sur.plus.test" });
    }
    if (url.includes("/rest/v1/users")) {
      return Response.json([
        {
          id: "usr-admin",
          email: "ops@sur.plus.test",
          full_name: "Ops",
          role: "admin",
          company_id: null,
          ngo_id: null,
          created_at: "2026-06-24T10:00:00.000Z"
        }
      ]);
    }

    return Response.json([]);
  });
}

function authenticatedRequest() {
  return new NextRequest("http://127.0.0.1:3000/api/matches/mat-thinkpads/messages", {
    headers: {
      authorization: "Bearer user-jwt"
    }
  });
}

function supabaseFetchMock(authUserId: string) {
  return vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe("anon-key");
    expect(headers.get("authorization")).toBe("Bearer user-jwt");

    if (url.includes("/auth/v1/user")) {
      return Response.json({
        id: authUserId,
        email: `${authUserId}@sur.plus.test`
      });
    }
    if (url.includes("/rest/v1/users")) {
      return Response.json([
        {
          id: "usr-corporate-acme",
          email: "corporate@sur.plus.test",
          full_name: "Corporate User",
          role: "corporate",
          company_id: "cmp-acme",
          ngo_id: null,
          created_at: "2026-06-24T10:00:00.000Z"
        }
      ]);
    }

    return Response.json([]);
  });
}

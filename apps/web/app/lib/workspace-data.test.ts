import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWorkspaceData } from "./workspace-data";

describe("loadWorkspaceData SSR auth boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("pins the server-rendered actor to the authenticated user id", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const requests: string[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = new URL(String(input));
        const headers = new Headers(init?.headers);
        requests.push(`${url.pathname}:${headers.get("apikey")}:${headers.get("authorization")}`);

        if (url.pathname === "/rest/v1/users") {
          return Response.json([
            userRow({
              company_id: "cmp-acme",
              id: "usr-corporate-acme",
              role: "corporate"
            }),
            userRow({
              id: "usr-ngo",
              ngo_id: "ngo-schule",
              role: "ngo"
            })
          ]);
        }

        return Response.json([]);
      })
    );

    const workspace = await loadWorkspaceData({
      authorization: "Bearer user-jwt",
      preferredRole: "ngo",
      preferredUserId: "usr-corporate-acme"
    });

    expect(workspace.actor).toEqual({
      role: "corporate",
      userId: "usr-corporate-acme",
      companyId: "cmp-acme"
    });
    expect(requests).toContain("/rest/v1/users:anon-key:Bearer user-jwt");
    expect(requests.some((request) => request.includes("service-key"))).toBe(false);
  });

  it("fails closed when an authenticated user has no workspace profile", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        if (url.pathname === "/rest/v1/users") {
          return Response.json([
            userRow({
              company_id: "cmp-acme",
              id: "usr-corporate-acme",
              role: "corporate"
            })
          ]);
        }

        return Response.json([]);
      })
    );

    await expect(
      loadWorkspaceData({
        authorization: "Bearer user-jwt",
        preferredRole: "corporate",
        preferredUserId: "usr-missing"
      })
    ).rejects.toThrow("Authenticated user has no workspace profile");
  });

  it("keeps preview fallback for unauthenticated Supabase preview loads", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        const url = new URL(String(input));
        if (url.pathname === "/rest/v1/users") {
          return Response.json([
            userRow({
              company_id: "cmp-acme",
              id: "usr-corporate-acme",
              role: "corporate"
            })
          ]);
        }

        return Response.json([]);
      })
    );

    const workspace = await loadWorkspaceData({
      preferredRole: "corporate",
      preferredUserId: "usr-missing"
    });

    expect(workspace.source).toBe("preview");
    expect(workspace.warning).toBe("Authenticated user has no workspace profile");
  });

  it("fails loud in production when Supabase is configured but unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      })
    );

    await expect(
      loadWorkspaceData({ preferredRole: "corporate" })
    ).rejects.toThrow("connect ECONNREFUSED");
  });

  it("allows the production preview fallback only with the explicit env opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SURPLUS_ALLOW_PREVIEW_FALLBACK", "true");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      })
    );

    const workspace = await loadWorkspaceData({ preferredRole: "corporate" });

    expect(workspace.source).toBe("preview");
    expect(workspace.warning).toBe("Supabase data load failed; check server logs.");
  });
});

function userRow(input: {
  company_id?: string;
  id: string;
  ngo_id?: string;
  role: "admin" | "corporate" | "ngo";
}) {
  return {
    company_id: input.company_id ?? null,
    created_at: "2026-06-24T10:00:00.000Z",
    email: `${input.id}@sur.plus.test`,
    full_name: input.id,
    id: input.id,
    ngo_id: input.ngo_id ?? null,
    role: input.role
  };
}

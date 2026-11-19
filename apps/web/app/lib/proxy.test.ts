import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "../../proxy";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn()
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock
}));

describe("proxy session refresh", () => {
  afterEach(() => {
    createServerClientMock.mockReset();
    vi.unstubAllEnvs();
  });

  it("keeps the CSP nonce path without Supabase config", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/"));

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self' 'nonce-");
  });

  /*
   * Regression guard: inline style ATTRIBUTES carry the role accent
   * (`--sp-accent*`) and every dynamic colour. A nonce cannot cover attributes,
   * and a nonce inside style-src makes 'unsafe-inline' be ignored — which once
   * silently blanked the accent in production only.
   */
  it("allows inline style attributes so the role accent survives in production", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3000/"));
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/style-src[^;]*nonce-/);
  });

  it("refreshes Supabase auth cookies while preserving security headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    createServerClientMock.mockImplementation(
      (_url: string, _key: string, options: { cookies: { setAll: (cookies: CookieToSet[]) => void } }) => ({
        auth: {
          getUser: vi.fn(async () => {
            options.cookies.setAll([
              {
                name: "sb-project-auth-token",
                options: {
                  httpOnly: true,
                  path: "/",
                  sameSite: "lax"
                },
                value: "refreshed"
              }
            ]);

            return {
              data: {
                user: {
                  id: "usr-corporate-acme"
                }
              },
              error: null
            };
          })
        }
      })
    );

    const response = await proxy(
      new NextRequest("http://127.0.0.1:3000/", {
        headers: {
          cookie: "sb-project-auth-token=stale"
        }
      })
    );

    expect(createServerClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      expect.any(Object)
    );
    expect(response.cookies.get("sb-project-auth-token")?.value).toBe("refreshed");
    expect(response.headers.get("content-security-policy")).toContain("connect-src 'self' https://*.supabase.co");
  });
});

type CookieToSet = {
  name: string;
  options: {
    httpOnly: boolean;
    path: string;
    sameSite: "lax";
  };
  value: string;
};

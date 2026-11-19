import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceRouteRateLimit } from "./rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enforceRouteRateLimit", () => {
  it("counts in this process when no shared store is configured", async () => {
    const results: Array<number | null> = [];
    for (let index = 0; index < 22; index += 1) {
      const blocked = await enforceRouteRateLimit({ actorId: "local-actor", endpointId: "test.local", policy: "strict" });
      results.push(blocked?.status ?? null);
    }

    expect(results.slice(0, 20).every((status) => status === null)).toBe(true);
    expect(results.slice(20)).toEqual([429, 429]);
  });

  it("uses the shared Postgres counter with the service-role key, so every server agrees", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = [];
    let used = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        used += 1;
        calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) });

        return Response.json([{ allowed: used <= 20, remaining: Math.max(0, 20 - used), reset_at: new Date(Date.now() + 30_000).toISOString() }]);
      })
    );

    for (let index = 0; index < 20; index += 1) {
      expect(await enforceRouteRateLimit({ actorId: "shared-actor", endpointId: "test.shared", policy: "strict" })).toBeNull();
    }
    const blocked = await enforceRouteRateLimit({ actorId: "shared-actor", endpointId: "test.shared", policy: "strict" });

    expect(blocked?.status).toBe(429);
    expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(calls[0]).toMatchObject({
      url: "https://project.supabase.co/rest/v1/rpc/reserve_rate_limit",
      auth: "Bearer service-key",
      body: { p_key: "shared-actor:test.shared", p_limit: 20, p_window_seconds: 60 }
    });
  });

  it("falls back to counting locally when the shared store is down", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const statuses: Array<number | null> = [];
    for (let index = 0; index < 21; index += 1) {
      statuses.push((await enforceRouteRateLimit({ actorId: "fallback-actor", endpointId: "test.fallback", policy: "strict" }))?.status ?? null);
    }

    expect(statuses.slice(0, 20).every((status) => status === null)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

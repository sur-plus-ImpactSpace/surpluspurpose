import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DEMO_COOKIE, clearSandboxes, getSandbox, sandboxCount } from "../../lib/demo-sandbox";
import { POST } from "./route";

const enter = (fields: Record<string, string>, ip = "10.1.0.1") => {
  const body = new URLSearchParams(fields);

  return POST(
    new NextRequest("http://127.0.0.1:3000/demo/enter", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip },
      body
    })
  );
};

beforeEach(() => clearSandboxes());
afterEach(() => vi.unstubAllEnvs());

describe("demo entry", () => {
  it("creates a private sandbox, remembers it in a cookie and sends the visitor in", async () => {
    const response = await enter({ role: "ngo", lang: "de" });

    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).pathname + new URL(response.headers.get("location")!).search).toBe("/demo?role=ngo&lang=de");
    const cookie = response.cookies.get(DEMO_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(getSandbox(cookie?.value)).toBeDefined();
  });

  it("gives every visitor their own sandbox", async () => {
    const a = (await enter({ role: "corporate" }, "10.1.0.2")).cookies.get(DEMO_COOKIE)?.value;
    const b = (await enter({ role: "corporate" }, "10.1.0.3")).cookies.get(DEMO_COOKIE)?.value;

    expect(a).not.toBe(b);
    expect(sandboxCount()).toBe(2);
  });

  it("falls back to the company view for an unknown role and keeps the URL clean", async () => {
    const response = await enter({ role: "root" }, "10.1.0.4");

    expect(new URL(response.headers.get("location")!).search).toBe("");
  });

  it("is gated by the access token on a real deployment", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SURPLUS_DEMO_ACCESS_TOKEN", "letmein");

    const denied = await enter({ role: "corporate", key: "wrong" }, "10.1.0.5");
    expect(new URL(denied.headers.get("location")!).pathname).toBe("/login");
    expect(denied.cookies.get(DEMO_COOKIE)).toBeUndefined();
    expect(sandboxCount()).toBe(0);

    const allowed = await enter({ role: "corporate", key: "letmein" }, "10.1.0.5");
    expect(new URL(allowed.headers.get("location")!).search).toBe("?key=letmein");
    expect(sandboxCount()).toBe(1);
  });

  it("stays closed on a real deployment with no token configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");

    expect(new URL((await enter({ role: "corporate", key: "" }, "10.1.0.6")).headers.get("location")!).pathname).toBe("/login");
  });

  it("limits how fast one address can allocate sandboxes", async () => {
    const statuses: number[] = [];
    for (let index = 0; index < 25; index += 1) statuses.push((await enter({ role: "corporate" }, "10.9.0.9")).status);

    expect(statuses).toContain(429);
    expect(sandboxCount()).toBeLessThan(25);
  });
});

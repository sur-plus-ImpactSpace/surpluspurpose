import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const SECRET = "whsec_test";

function setup() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("STRIPE_PRICE_SEED", "price_seed");
  vi.stubEnv("STRIPE_PRICE_TREE", "price_tree");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
}

function webhook(event: unknown, options: { signed?: boolean; secret?: string } = {}) {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha256", options.secret ?? SECRET).update(`${timestamp}.${body}`).digest("hex");

  return new NextRequest("http://127.0.0.1:3000/api/stripe/webhook", {
    method: "POST",
    headers: options.signed === false ? {} : { "stripe-signature": `t=${timestamp},v1=${signature}` },
    body
  });
}

const paid = (overrides: Record<string, unknown> = {}) => ({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { client_reference_id: "cmp-1", payment_status: "paid", metadata: { company_id: "cmp-1", plan: "tree" }, ...overrides } }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("stripe webhook", () => {
  it("fails closed when payments are not configured", async () => {
    expect((await POST(webhook(paid()))).status).toBe(503);
  });

  it("rejects an unsigned or wrongly signed request and changes nothing", async () => {
    setup();
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }]));
    vi.stubGlobal("fetch", fetchMock);

    expect((await POST(webhook(paid(), { signed: false }))).status).toBe(400);
    expect((await POST(webhook(paid(), { secret: "attacker" }))).status).toBe(400);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("activate_company_plan_from_payment"))).toBe(false);
  });

  it("activates the plan through the service role after a paid checkout", async () => {
    setup();
    const calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body ?? "{}")) });
        if (url.includes("reserve_rate_limit")) return Response.json([{ allowed: true, remaining: 100, reset_at: new Date(Date.now() + 60_000).toISOString() }]);

        return Response.json(true);
      })
    );

    const response = await POST(webhook(paid()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, activated: true });
    const activation = calls.find((call) => call.url.includes("activate_company_plan_from_payment"));
    expect(activation?.auth).toBe("Bearer service-key");
    expect(activation?.body).toEqual({ p_company: "cmp-1", p_plan: "tree", p_event_id: "evt_1" });
  });

  it("ignores events that are not a paid checkout", async () => {
    setup();
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }]));
    vi.stubGlobal("fetch", fetchMock);

    for (const event of [{ id: "e2", type: "invoice.paid" }, paid({ payment_status: "unpaid" }), paid({ metadata: { company_id: "cmp-1", plan: "registered" } })]) {
      const response = await POST(webhook(event));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ ignored: true });
    }
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("reserve_rate_limit"))).toBe(true);
  });

  it("answers 503 when activation fails so Stripe retries", async () => {
    setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) =>
        String(input).includes("reserve_rate_limit")
          ? Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }])
          : new Response("db down", { status: 500 })
      )
    );

    expect((await POST(webhook(paid()))).status).toBe(503);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const ctx = (companyId: string) => ({ params: Promise.resolve({ companyId }) });
const req = (companyId: string, body: unknown, key: string | null, actor = "usr-corporate-acme") =>
  new NextRequest(`http://127.0.0.1:3000/api/companies/${companyId}/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-surplus-preview-user-id": actor, ...(key ? { "idempotency-key": key } : {}) },
    body: JSON.stringify(body)
  });

function configureStripe() {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_x");
  vi.stubEnv("STRIPE_PRICE_SEED", "price_seed");
  vi.stubEnv("STRIPE_PRICE_TREE", "price_tree");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("plan checkout route", () => {
  it("validates the request", async () => {
    expect((await POST(req("co-acme", { plan: "tree" }, null), ctx("co-acme"))).status).toBe(428);
    expect((await POST(req("co-acme", { plan: "registered" }, "c1"), ctx("co-acme"))).status).toBe(422);
  });

  it("is for a company's own members only; NGOs stay free", async () => {
    expect((await POST(req("co-hanse", { plan: "tree" }, "c2"), ctx("co-hanse"))).status).toBe(403);
    expect((await POST(req("co-acme", { plan: "tree" }, "c3", "usr-ngo-kleiderkammer"), ctx("co-acme"))).status).toBe(403);
  });

  it("only sells upgrades", async () => {
    // co-acme is on Seed in the preview seed
    const response = await POST(req("co-acme", { plan: "seed" }, "c4"), ctx("co-acme"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "not_an_upgrade" });
  });

  it("fails closed without Stripe configuration", async () => {
    const response = await POST(req("co-acme", { plan: "tree" }, "c5"), ctx("co-acme"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "payments_not_configured" });
  });

  it("returns the Stripe Checkout URL and never changes the plan itself", async () => {
    configureStripe();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test_9" })));

    const response = await POST(req("co-acme", { plan: "tree" }, "c6"), ctx("co-acme"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ url: "https://checkout.stripe.com/c/pay/cs_test_9" });
  });

  it("reports Stripe trouble as unavailable", async () => {
    configureStripe();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));

    const response = await POST(req("co-acme", { plan: "tree" }, "c7"), ctx("co-acme"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "stripe_unavailable" });
  });
});

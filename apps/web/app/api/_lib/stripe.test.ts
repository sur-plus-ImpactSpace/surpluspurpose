import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession, stripeConfigFromEnv, verifyStripeSignature } from "./stripe";

const SECRET = "whsec_test";
const NOW = 1_800_000_000;
const sign = (body: string, timestamp = NOW, secret = SECRET) =>
  `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

afterEach(() => vi.unstubAllEnvs());

describe("verifyStripeSignature", () => {
  const body = '{"id":"evt_1"}';

  it("accepts a correctly signed, recent payload", () => {
    expect(verifyStripeSignature(body, sign(body), SECRET, NOW)).toBe(true);
  });

  it("rejects a tampered body, a wrong secret and a missing or malformed header", () => {
    expect(verifyStripeSignature('{"id":"evt_2"}', sign(body), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, NOW, "other"), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(body, null, SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(body, "garbage", SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(body, `t=${NOW},v1=zz`, SECRET, NOW)).toBe(false);
  });

  it("rejects a replay outside the five-minute window", () => {
    expect(verifyStripeSignature(body, sign(body, NOW - 301), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, NOW + 301), SECRET, NOW)).toBe(false);
    expect(verifyStripeSignature(body, sign(body, NOW - 299), SECRET, NOW)).toBe(true);
  });

  it("accepts any matching signature when Stripe sends several", () => {
    const good = sign(body).split(",v1=")[1];
    expect(verifyStripeSignature(body, `t=${NOW},v1=${"0".repeat(64)},v1=${good}`, SECRET, NOW)).toBe(true);
  });
});

describe("stripeConfigFromEnv", () => {
  it("fails closed unless every setting is present", () => {
    expect(stripeConfigFromEnv()).toBeNull();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    vi.stubEnv("STRIPE_PRICE_SEED", "price_seed");
    expect(stripeConfigFromEnv()).toBeNull();
    vi.stubEnv("STRIPE_PRICE_TREE", "price_tree");
    expect(stripeConfigFromEnv()).toEqual({ secretKey: "sk_test_x", webhookSecret: SECRET, prices: { seed: "price_seed", tree: "price_tree" } });
  });
});

describe("createCheckoutSession", () => {
  const config = { secretKey: "sk_test_x", webhookSecret: SECRET, prices: { seed: "price_seed", tree: "price_tree" } };
  const input = { companyId: "cmp-1", plan: "tree" as const, customerEmail: "lea@acme-gmbh.de", origin: "https://app.sur.plus", idempotencyKey: "idem-1" };

  it("asks Stripe for a subscription checkout carrying the company and plan", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
    const result = await createCheckoutSession(config, input, fetchImpl as unknown as typeof fetch);

    expect(result).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk_test_x");
    const form = new URLSearchParams(String(init.body));
    expect(form.get("line_items[0][price]")).toBe("price_tree");
    expect(form.get("metadata[company_id]")).toBe("cmp-1");
    expect(form.get("metadata[plan]")).toBe("tree");
    expect(form.get("success_url")).toBe("https://app.sur.plus/account?checkout=success");
  });

  it("reports Stripe trouble without leaking details", async () => {
    expect(await createCheckoutSession(config, input, (async () => new Response("no", { status: 500 })) as unknown as typeof fetch)).toEqual({ error: "stripe_unavailable" });
    expect(await createCheckoutSession(config, input, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toEqual({ error: "stripe_unavailable" });
  });
});

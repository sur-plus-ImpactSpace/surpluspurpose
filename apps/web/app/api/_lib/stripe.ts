import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";
const TOLERANCE_SECONDS = 300;

export type StripeConfig = { secretKey: string; webhookSecret: string; prices: { seed: string; tree: string } };

/** Missing configuration fails closed: no key, no checkout, no webhook. Keys are never committed. */
export function stripeConfigFromEnv(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const seed = process.env.STRIPE_PRICE_SEED;
  const tree = process.env.STRIPE_PRICE_TREE;
  if (!secretKey || !webhookSecret || !seed || !tree) return null;

  return { secretKey, webhookSecret, prices: { seed, tree } };
}

export async function createCheckoutSession(
  config: StripeConfig,
  input: { companyId: string; plan: "seed" | "tree"; customerEmail: string; origin: string; idempotencyKey: string },
  fetchImpl: typeof fetch = fetch
): Promise<{ url: string } | { error: "stripe_unavailable" }> {
  const body = new URLSearchParams({
    mode: "subscription",
    "line_items[0][price]": config.prices[input.plan],
    "line_items[0][quantity]": "1",
    client_reference_id: input.companyId,
    customer_email: input.customerEmail,
    "metadata[company_id]": input.companyId,
    "metadata[plan]": input.plan,
    success_url: `${input.origin}/account?checkout=success`,
    cancel_url: `${input.origin}/account?checkout=cancelled`
  });

  try {
    const response = await fetchImpl(`${API}/checkout/sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": input.idempotencyKey
      },
      body,
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) return { error: "stripe_unavailable" };
    const session = (await response.json()) as { url?: unknown };

    return typeof session.url === "string" ? { url: session.url } : { error: "stripe_unavailable" };
  } catch {
    return { error: "stripe_unavailable" };
  }
}

/**
 * Verify a Stripe webhook: the signed payload is `${timestamp}.${rawBody}`,
 * HMAC-SHA256 with the endpoint secret, compared in constant time, and the
 * timestamp must be recent so a captured request cannot be replayed later.
 */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds = Date.now() / 1000): boolean {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");

    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

import { activatePlanFromPaymentWithServiceRole } from "@surplus/domain";
import { NextRequest } from "next/server";
import { enforceRouteRateLimit } from "../../_lib/rate-limit";
import { routeJson } from "../../_lib/route-workspace";
import { stripeConfigFromEnv, verifyStripeSignature } from "../../_lib/stripe";

export const dynamic = "force-dynamic";

type StripeEvent = {
  id?: unknown;
  type?: unknown;
  data?: { object?: { client_reference_id?: unknown; payment_status?: unknown; metadata?: { company_id?: unknown; plan?: unknown } } };
};

/**
 * Stripe's signed webhook is the only thing that changes a plan on payment.
 * Signature first (raw body, constant-time, recent timestamp); then a paid
 * checkout.session.completed activates the plan through a service-role RPC that
 * is idempotent per event id, since Stripe delivers at least once. Other events
 * are acknowledged and ignored; cancellations stay a manual Ops action.
 */
export async function POST(request: NextRequest) {
  const stripe = stripeConfigFromEnv();
  if (!stripe) return routeJson({ error: "payments_not_configured" }, 503);

  const rateLimit = await enforceRouteRateLimit({ actorId: "stripe", endpointId: "stripe.webhook", policy: "webhook" });
  if (rateLimit) return rateLimit;

  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), stripe.webhookSecret)) {
    return routeJson({ error: "invalid_signature" }, 400);
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return routeJson({ error: "invalid_payload" }, 400);
  }
  if (event.type !== "checkout.session.completed") return routeJson({ received: true, ignored: true }, 200);

  const session = event.data?.object;
  const companyId = session?.metadata?.company_id ?? session?.client_reference_id;
  const plan = session?.metadata?.plan;
  if (
    typeof event.id !== "string" ||
    typeof companyId !== "string" ||
    (plan !== "seed" && plan !== "tree") ||
    session?.payment_status !== "paid"
  ) {
    return routeJson({ received: true, ignored: true }, 200);
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return routeJson({ error: "service_role_not_configured" }, 503);

  try {
    const activated = await activatePlanFromPaymentWithServiceRole(
      { url, key: serviceKey, authorization: `Bearer ${serviceKey}` },
      { companyId, plan, eventId: event.id }
    );

    return routeJson({ received: true, activated }, 200);
  } catch (error) {
    console.error("plan activation failed", error);

    // A non-2xx answer makes Stripe retry later.
    return routeJson({ error: "persistence_unavailable" }, 503);
  }
}

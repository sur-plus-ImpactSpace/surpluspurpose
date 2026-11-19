import { PLAN_TIERS, parsePlanCheckoutCommand } from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";
import { createCheckoutSession, stripeConfigFromEnv } from "../../../_lib/stripe";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ companyId: string }> };

/**
 * A company starts buying Seed or Tree: returns a Stripe Checkout URL. This only
 * opens the payment page; the plan changes when Stripe's signed webhook says it
 * was paid (/api/stripe/webhook), never here. NGOs are always free, so only a
 * company's own members can start a checkout. Ops can still set plans by hand.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const command = parsePlanCheckoutCommand(request.headers, companyId, body);
  if (!command.ok) return routeJson({ error: command.reason }, command.status);

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, data } = workspaceDecision.workspace;
  if (actor.role !== "corporate" || actor.companyId !== command.command.companyId) {
    return routeJson({ error: "actor_not_allowed" }, 403);
  }
  const company = data.companies.find((item) => item.id === actor.companyId);
  if (!company) return routeJson({ error: "company_not_found" }, 404);
  if (PLAN_TIERS.indexOf(command.command.plan) <= PLAN_TIERS.indexOf(company.plan)) {
    return routeJson({ error: "not_an_upgrade" }, 409);
  }

  const stripe = stripeConfigFromEnv();
  if (!stripe) return routeJson({ error: "payments_not_configured" }, 503);

  const endpointId = "companies.checkout";
  const rateLimit = await enforceRouteRateLimit({ actorId: actor.userId, endpointId, policy: "strict" });
  if (rateLimit) return rateLimit;

  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: { companyId: actor.companyId, plan: command.command.plan }
  });
  if (idempotency.kind === "response") return idempotency.response;

  const session = await createCheckoutSession(stripe, {
    companyId: actor.companyId,
    plan: command.command.plan,
    customerEmail: data.users.find((user) => user.id === actor.userId)?.email ?? company.contactEmail,
    origin: new URL(request.url).origin,
    idempotencyKey: `${actor.companyId}:${command.command.plan}:${command.command.idempotencyKey}`
  });
  if ("error" in session) {
    await idempotency.fail();

    return routeJson({ error: session.error }, 503);
  }

  const response = { idempotencyKey: command.command.idempotencyKey, url: session.url };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "company",
    resourceId: actor.companyId
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

import {
  parseCompanyCheckCommand,
  recordCompanyCheckWithServiceRole,
  type CompanyCheck
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { runCompanyCheck } from "../../../_lib/company-check";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ companyId: string }> };

/**
 * A company gives its VAT ID and website; the server checks VIES, the contact
 * email domain and the website, then approves automatically if all three pass
 * and otherwise queues the company for Ops (ADR 0027 C3). The result is written
 * with the service role only, so a user session cannot forge a passing check.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const command = parseCompanyCheckCommand(request.headers, companyId, body);
  if (!command.ok) return routeJson({ error: command.reason }, command.status);

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, data, repository, runtime } = workspaceDecision.workspace;
  // Only the company's own members; this endpoint makes outbound requests, so it stays narrow.
  if (actor.role !== "corporate" || actor.companyId !== command.command.companyId) {
    return routeJson({ error: "actor_not_allowed" }, 403);
  }
  const company = data.companies.find((item) => item.id === actor.companyId);
  if (!company) return routeJson({ error: "company_not_found" }, 404);
  if (company.verificationState === "verified") return routeJson({ error: "already_verified" }, 409);
  if (company.verificationState === "rejected") return routeJson({ error: "company_rejected" }, 409);

  const endpointId = "companies.autoCheck";
  const rateLimit = await enforceRouteRateLimit({ actorId: actor.userId, endpointId, policy: "strict" });
  if (rateLimit) return rateLimit;

  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: { companyId: actor.companyId, vatId: command.command.vatId, website: command.command.website }
  });
  if (idempotency.kind === "response") return idempotency.response;

  const contactEmail = data.users.find((user) => user.id === actor.userId)?.email ?? company.contactEmail;
  const result = await runCompanyCheck({
    vatId: command.command.vatId,
    website: command.command.website,
    contactEmail
  });
  const stored = { ...result, vatId: command.command.vatId, website: command.command.website };

  let check: CompanyCheck | undefined;
  if (runtime === "supabase") {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      await idempotency.fail();

      return routeJson({ error: "service_role_not_configured" }, 503);
    }
    try {
      await recordCompanyCheckWithServiceRole(
        { url, key: serviceKey, authorization: `Bearer ${serviceKey}` },
        { companyId: actor.companyId, ...stored }
      );
    } catch (error) {
      console.error("record_company_check failed", error);
      await idempotency.fail();

      return routeJson({ error: "persistence_unavailable" }, 503);
    }
  } else {
    check = repository.companies.recordCheck(actor.companyId, stored);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    approved: result.vatOk && result.domainOk && result.websiteOk,
    checks: { vat: result.vatOk, domain: result.domainOk, website: result.websiteOk },
    runtime,
    ...(check ? { checkId: check.id } : {})
  };
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

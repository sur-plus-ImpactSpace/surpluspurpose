import {
  SupabaseRepositoryError,
  parseCompanyPlanCommand,
  setCompanyPlanWithSupabaseRpc,
  type PlanTier,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

/**
 * Ops-only: move a company between registered / seed / tree. Until Stripe
 * lands, companies.plan is the only record of who pays, so this is the billing
 * action in everything but name — hence strict rate limiting, idempotency and
 * an admin guard that lives in the RPC and the repository, never in the parser.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params;
  const body = await request.json().catch(() => undefined);
  const command = parseCompanyPlanCommand(request.headers, companyId, body);

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = "companies.plan";
  const rateLimit = await enforceRouteRateLimit({
    actorId: actor.userId,
    endpointId,
    policy: "strict"
  });
  if (rateLimit) return rateLimit;

  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: {
      companyId: command.command.companyId,
      plan: command.command.plan
    }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const result =
    runtime === "supabase"
      ? await setPersistentCompanyPlan(supabase, command.command.companyId, command.command.plan)
      : repository.companies.setPlan(command.command.companyId, command.command.plan, actor);

  if (!result.ok) {
    const status = statusForPlanError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({ responseStatus: status, responseBody: response });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    company: result.company,
    runtime
  };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "company",
    resourceId: result.company.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function statusForPlanError(reason: string): 401 | 403 | 404 | 409 | 503 | 422 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "company_not_found") return 404;
  if (reason === "actor_not_allowed" || reason === "forbidden") return 403;
  // The company has more seats filled than the target plan allows. Not an
  // error in the request — a state Ops has to resolve first.
  if (reason === "seat_limit_exceeded") return 409;
  if (reason === "persistence_unavailable") return 503;

  return 422;
}

async function setPersistentCompanyPlan(
  supabase: SupabaseRestConfig,
  companyId: string,
  plan: PlanTier
) {
  try {
    return await setCompanyPlanWithSupabaseRpc(supabase, { companyId, plan });
  } catch (error) {
    return { ok: false as const, reason: planSupabaseErrorReason(error) };
  }
}

function planSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "persistence_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "forbidden",
    "company_not_found",
    "invalid_plan",
    "seat_limit_exceeded"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));
  if (reason) return reason;

  if (error.message.includes("invalid input syntax for type uuid")) return "company_not_found";

  return "persistence_unavailable";
}

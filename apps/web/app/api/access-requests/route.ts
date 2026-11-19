import {
  SupabaseRepositoryError,
  parseAccessRequestCommand,
  submitAccessRequestWithSupabaseRpc,
  type AccessRequestInput,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { deliverAccessRequestNotice } from "../_lib/invitation-email";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadPublicRouteRuntime, routeJson } from "../_lib/route-workspace";

export const dynamic = "force-dynamic";

/**
 * Public "Request access" form (REQ-AUTH-05): no session, so the abuse
 * controls are input validation, a honeypot, a per-IP strict rate limit and the
 * database's one-row-per-email rule. Repeating a request is therefore
 * idempotent by construction, and the response never says whether the email was
 * already known.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseAccessRequestCommand(request.headers, body);

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const rateLimit = await enforceRouteRateLimit({
    actorId: `ip:${clientAddress(request)}`,
    endpointId: "accessRequests.submit",
    policy: "strict"
  });
  if (rateLimit) return rateLimit;

  // Bots get the same answer as people; nothing is stored.
  if (command.command.spam) return routeJson({ ok: true }, 202);

  const runtime = loadPublicRouteRuntime();
  if (!runtime.ok) return runtime.response;

  if (runtime.runtime === "supabase") {
    const failure = await submitPersistent(runtime.supabase, command.command.input);
    if (failure) return routeJson({ error: failure.reason }, failure.status);
  } else {
    runtime.repository.accessRequests.submit(command.command.input);
  }

  // The request is stored; telling Ops is best effort and never fails the visitor.
  const notice = await deliverAccessRequestNotice(command.command.input).catch((error: unknown) => ({
    status: "failed" as const,
    error: String(error)
  }));
  if (notice.status === "failed") console.error("access request notice not delivered", notice.error);

  return routeJson({ ok: true }, 202);
}

function clientAddress(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

async function submitPersistent(
  supabase: SupabaseRestConfig,
  input: AccessRequestInput
): Promise<{ reason: string; status: 422 | 503 } | null> {
  try {
    await submitAccessRequestWithSupabaseRpc(supabase, input);

    return null;
  } catch (error) {
    // The parser enforces the same limits as the RPC, so a validation error from
    // the database means the two drifted — surface it as unavailable, not as the
    // visitor's mistake.
    if (error instanceof SupabaseRepositoryError && error.status === 400) {
      console.error("submit_access_request rejected a validated payload", error.message);
    }

    return { reason: "persistence_unavailable", status: 503 };
  }
}

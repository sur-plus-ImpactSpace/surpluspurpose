import {
  createInvitationWithSupabaseRpc,
  SupabaseRepositoryError,
  parseInvitationCommand
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../_lib/idempotency";
import { recordInvitationDeliveryAudit } from "../_lib/invitation-delivery-audit";
import { deliverInvitationEmail, type InvitationEmailDelivery } from "../_lib/invitation-email";
import { createInvitationAcceptanceToken } from "../_lib/invitation-token";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../_lib/route-workspace";

export const dynamic = "force-dynamic";
const endpointId = "invitations.create";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseInvitationCommand(request.headers, body);

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;

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
    body: command.command.input
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  const acceptance = await createInvitationAcceptanceToken();
  const invitationInput = {
    ...command.command.input,
    acceptanceTokenHash: acceptance.tokenHash
  };
  const invitationUrl = invitationAcceptanceUrl(request, acceptance.token);

  if (runtime === "supabase") {
    try {
      const invitation = await createInvitationWithSupabaseRpc(supabase, invitationInput);
      const delivery = await deliverInvitationEmail({
        acceptanceUrl: invitationUrl,
        invitation
      });
      const deliveryAudit = await recordInvitationDeliveryAudit({
        actor,
        delivery,
        invitationId: invitation.id,
        operation: "create",
        repository,
        runtime,
        supabase
      });
      const response = {
        ...acceptanceResponseFields(acceptance.token, invitationUrl, delivery),
        delivery,
        deliveryAudit,
        idempotencyKey: command.command.idempotencyKey,
        invitation,
        runtime: "supabase-rpc"
      };
      const completed = await idempotency.complete({
        responseStatus: 201,
        responseBody: response,
        resourceType: "invitation",
        resourceId: invitation.id
      });
      if (!completed) {
        await idempotency.fail();

        return routeJson({ error: "idempotency_completion_failed" }, 503);
      }

      return routeJson(response, 201);
    } catch (error) {
      const reason = invitationSupabaseErrorReason(error);
      const status = statusForInvitationError(reason);
      const response = { error: reason };
      await idempotency.complete({
        responseStatus: status,
        responseBody: response
      });

      return routeJson(response, status);
    }
  }

  const result = repository.invitations.create(actor, invitationInput);
  if (!result.ok) {
    const status = statusForInvitationError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const previewDelivery: InvitationEmailDelivery = {
    provider: "not_configured",
    reason: "email_provider_not_configured",
    status: "skipped"
  };
  const deliveryAudit = await recordInvitationDeliveryAudit({
    actor,
    delivery: previewDelivery,
    invitationId: result.invitation.id,
    operation: "create",
    repository,
    runtime,
    supabase
  });
  const response = {
    ...acceptanceResponseFields(acceptance.token, invitationUrl, previewDelivery),
    delivery: previewDelivery,
    deliveryAudit,
    idempotencyKey: command.command.idempotencyKey,
    invitation: result.invitation,
    runtime: "preview-route-handler"
  };

  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "invitation",
    resourceId: result.invitation.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

function acceptanceResponseFields(
  acceptanceToken: string,
  acceptanceUrl: string,
  delivery: InvitationEmailDelivery
): { acceptanceToken: string | null; acceptanceUrl: string | null } {
  const exposeSecret = process.env.NODE_ENV !== "production" || delivery.status !== "sent";

  return {
    acceptanceToken: exposeSecret ? acceptanceToken : null,
    acceptanceUrl: exposeSecret ? acceptanceUrl : null
  };
}

function invitationAcceptanceUrl(request: NextRequest, token: string): string {
  const url = new URL("/", request.url);
  url.searchParams.set("invite", token);

  return url.toString();
}

function statusForInvitationError(reason: string): 403 | 409 | 422 | 503 {
  if (reason === "actor_not_allowed") return 403;
  if (reason === "pending_invitation_exists" || reason === "seat_limit_exceeded") return 409;
  if (reason === "invitation_unavailable") return 503;

  return 422;
}

function invitationSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "invitation_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "invalid_invitation",
    "actor_not_allowed",
    "invalid_scope",
    "company_not_found",
    "ngo_not_found",
    "seat_limit_exceeded",
    "pending_invitation_exists"
  ];
  const message = error.message;
  const reason = knownReasons.find((item) => message.includes(item));

  return reason ?? "invitation_unavailable";
}

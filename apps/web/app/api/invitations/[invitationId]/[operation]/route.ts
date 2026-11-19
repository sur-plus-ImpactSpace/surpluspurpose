import {
  parseInvitationMutationCommand,
  resendInvitationWithSupabaseRpc,
  revokeInvitationWithSupabaseRpc,
  SupabaseRepositoryError,
  type ActorContext,
  type InvitationOperation,
  type SupabaseRestConfig,
  type SurplusRepository
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { reserveRouteIdempotency } from "../../../_lib/idempotency";
import { recordInvitationDeliveryAudit } from "../../../_lib/invitation-delivery-audit";
import { deliverInvitationEmail, type InvitationEmailDelivery } from "../../../_lib/invitation-email";
import { createInvitationAcceptanceToken } from "../../../_lib/invitation-token";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    invitationId: string;
    operation: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const command = parseInvitationMutationCommand(request.headers, params);

  if (!command.ok) {
    return routeJson({ error: command.reason }, command.status);
  }

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, repository, runtime, supabase } = workspaceDecision.workspace;
  const endpointId = `invitations.${command.command.operation}`;
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
      invitationId: command.command.invitationId,
      operation: command.command.operation
    }
  });
  if (idempotency.kind === "response") {
    return idempotency.response;
  }

  if (command.command.operation === "resend") {
    const acceptance = await createInvitationAcceptanceToken();
    const invitationUrl = invitationAcceptanceUrl(request, acceptance.token);
    const result =
      runtime === "supabase"
        ? await executePersistentInvitationResend(supabase, command.command.invitationId, acceptance.tokenHash)
        : executeInvitationResend(repository, actor, command.command.invitationId);
    if (!result.ok) {
      const status = statusForInvitationMutationError(result.reason);
      const response = { error: result.reason };
      await idempotency.complete({
        responseStatus: status,
        responseBody: response
      });

      return routeJson(response, status);
    }

    const delivery =
      runtime === "supabase"
        ? await deliverInvitationEmail({
            acceptanceUrl: invitationUrl,
            invitation: result.invitation
          })
        : previewDelivery();
    const deliveryAudit = await recordInvitationDeliveryAudit({
      actor,
      delivery,
      invitationId: result.invitation.id,
      operation: "resend",
      repository,
      runtime,
      supabase
    });
    const response = {
      ...acceptanceResponseFields(acceptance.token, invitationUrl, delivery),
      delivery,
      deliveryAudit,
      idempotencyKey: command.command.idempotencyKey,
      invitation: result.invitation,
      runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
    };
    const completed = await idempotency.complete({
      responseStatus: 200,
      responseBody: response,
      resourceType: "invitation",
      resourceId: result.invitation.id
    });
    if (!completed) {
      await idempotency.fail();

      return routeJson({ error: "idempotency_completion_failed" }, 503);
    }

    return routeJson(response, 200);
  }

  const result =
    runtime === "supabase"
      ? await executePersistentInvitationMutation(supabase, command.command.operation, command.command.invitationId)
      : executeInvitationMutation(repository, actor, command.command.operation, command.command.invitationId);
  if (!result.ok) {
    const status = statusForInvitationMutationError(result.reason);
    const response = { error: result.reason };
    await idempotency.complete({
      responseStatus: status,
      responseBody: response
    });

    return routeJson(response, status);
  }

  const response = {
    idempotencyKey: command.command.idempotencyKey,
    invitation: result.invitation,
    runtime: runtime === "supabase" ? "supabase-rpc" : "preview-route-handler"
  };
  const completed = await idempotency.complete({
    responseStatus: 200,
    responseBody: response,
    resourceType: "invitation",
    resourceId: result.invitation.id
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 200);
}

function executeInvitationResend(repository: SurplusRepository, actor: ActorContext, invitationId: string) {
  return repository.invitations.resend(actor, invitationId);
}

function executeInvitationMutation(
  repository: SurplusRepository,
  actor: ActorContext,
  operation: InvitationOperation,
  invitationId: string
) {
  if (operation === "revoke") return repository.invitations.revoke(actor, invitationId);

  return { ok: false as const, reason: "invalid_operation" };
}

async function executePersistentInvitationMutation(
  supabase: SupabaseRestConfig,
  operation: InvitationOperation,
  invitationId: string
) {
  try {
    if (operation === "revoke") return await revokeInvitationWithSupabaseRpc(supabase, invitationId);

    return { ok: false as const, reason: "invalid_operation" };
  } catch (error) {
    return { ok: false as const, reason: invitationMutationSupabaseErrorReason(error) };
  }
}

async function executePersistentInvitationResend(
  supabase: SupabaseRestConfig,
  invitationId: string,
  acceptanceTokenHash: string
) {
  try {
    return await resendInvitationWithSupabaseRpc(supabase, {
      acceptanceTokenHash,
      invitationId
    });
  } catch (error) {
    return { ok: false as const, reason: invitationMutationSupabaseErrorReason(error) };
  }
}

function statusForInvitationMutationError(reason: string): 401 | 403 | 404 | 409 | 422 | 503 {
  if (reason === "auth_required" || reason === "actor_not_available") return 401;
  if (reason === "actor_not_allowed") return 403;
  if (reason === "invitation_not_found") return 404;
  if (reason === "invitation_not_pending") return 409;
  if (reason === "invitation_unavailable") return 503;

  return 422;
}

function invitationMutationSupabaseErrorReason(error: unknown): string {
  if (!(error instanceof SupabaseRepositoryError)) return "invitation_unavailable";

  const knownReasons = [
    "auth_required",
    "actor_not_available",
    "invitation_not_found",
    "actor_not_allowed",
    "invitation_not_pending",
    "invalid_invitation",
    "invalid_operation"
  ];
  const reason = knownReasons.find((item) => error.message.includes(item));

  return reason ?? "invitation_unavailable";
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

function previewDelivery(): InvitationEmailDelivery {
  return {
    provider: "not_configured",
    reason: "email_provider_not_configured",
    status: "skipped"
  };
}

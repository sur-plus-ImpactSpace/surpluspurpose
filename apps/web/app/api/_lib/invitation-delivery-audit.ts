import {
  recordInvitationDeliveryAttemptWithSupabaseRpc,
  type ActorContext,
  type InvitationDeliveryAttemptInput,
  type SupabaseRestConfig,
  type SurplusRepository
} from "@surplus/domain";
import type { InvitationEmailDelivery } from "./invitation-email";

type InvitationDeliveryAuditInput = {
  actor: ActorContext;
  delivery: InvitationEmailDelivery;
  invitationId: string;
  operation: "create" | "resend";
  repository: SurplusRepository;
  runtime: "preview" | "supabase";
  supabase: SupabaseRestConfig | null;
};

export type InvitationDeliveryAuditResult =
  | { status: "recorded" }
  | { status: "unavailable"; reason: string };

export async function recordInvitationDeliveryAudit({
  actor,
  delivery,
  invitationId,
  operation,
  repository,
  runtime,
  supabase
}: InvitationDeliveryAuditInput): Promise<InvitationDeliveryAuditResult> {
  const input = deliveryAttemptInput(invitationId, operation, delivery);

  try {
    const result =
      runtime === "supabase" && supabase
        ? await recordInvitationDeliveryAttemptWithSupabaseRpc(supabase, input)
        : repository.invitationDeliveries.record(actor, input);

    return result.ok ? { status: "recorded" } : { status: "unavailable", reason: result.reason };
  } catch (error) {
    console.error("Invitation delivery audit failed", error);

    return {
      status: "unavailable",
      reason: "delivery_audit_unavailable"
    };
  }
}

function deliveryAttemptInput(
  invitationId: string,
  operation: "create" | "resend",
  delivery: InvitationEmailDelivery
): InvitationDeliveryAttemptInput {
  if (delivery.status === "sent") {
    return {
      invitationId,
      operation,
      provider: delivery.provider,
      status: "sent",
      messageId: delivery.messageId
    };
  }
  if (delivery.status === "failed") {
    return {
      error: delivery.error,
      invitationId,
      operation,
      provider: delivery.provider,
      status: "failed"
    };
  }

  return {
    invitationId,
    operation,
    provider: delivery.provider,
    reason: delivery.reason,
    status: "skipped"
  };
}

"use client";

import { Button } from "@/components/ui/button";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { InvitationStatus } from "@surplus/domain";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type InvitationRevokeControlsProps = {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  initialStatus: InvitationStatus;
  invitationId: string;
};

type InvitationDelivery = {
  provider: string;
  reason?: string;
  status: "sent" | "skipped" | "failed";
};

type InvitationMutationSuccess = {
  acceptanceUrl?: string | null;
  delivery?: InvitationDelivery;
  invitation: {
    status: InvitationStatus;
  };
  runtime: "preview-route-handler" | "supabase-rpc";
};

type InvitationMutationResponse =
  | InvitationMutationSuccess
  | {
      error: string;
    };

export function InvitationRevokeControls({
  actorUserId,
  authConfig,
  initialStatus,
  invitationId
}: InvitationRevokeControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<InvitationStatus>(initialStatus);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const idempotencyPrefix = useMemo(() => stableId(), []);
  const disabled = isSubmitting || isRefreshing || status !== "pending";

  async function resendInvitation() {
    setSubmitting(true);
    setConfirming(false);
    setMessage(null);
    setFallbackLink(null);

    try {
      const body = await submitInvitationMutation("resend");
      if (!body) return;

      setStatus(body.invitation.status);
      setFallbackLink(body.acceptanceUrl ?? null);
      setMessage(resendMessage(body.delivery));
      if (body.runtime === "supabase-rpc") {
        startRefresh(() => router.refresh());
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeInvitation() {
    if (!confirming) {
      setConfirming(true);
      setMessage("Confirm to revoke this pending invitation.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setFallbackLink(null);

    try {
      const body = await submitInvitationMutation("revoke");
      if (!body) return;

      setStatus(body.invitation.status);
      setConfirming(false);
      setMessage("Invitation revoked.");
      if (body.runtime === "supabase-rpc") {
        startRefresh(() => router.refresh());
      }
    } catch {
      setMessage("Revoke failed: network_error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInvitationMutation(operation: "resend" | "revoke"): Promise<InvitationMutationSuccess | null> {
    try {
      const headers = await browserRouteHeaders({
        config: authConfig,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setMessage(operation === "resend" ? "Sign in before resending invitations." : "Sign in before revoking invitations.");
        return null;
      }

      const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/${operation}`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-${operation}-${Date.now()}`
        }
      });
      const body = (await response.json().catch(() => ({ error: "invalid_response" }))) as InvitationMutationResponse;

      if (!response.ok || "error" in body) {
        setMessage(`${operation === "resend" ? "Resend" : "Revoke"} failed: ${"error" in body ? body.error : response.status}`);
        return null;
      }

      return body;
    } catch {
      setMessage(`${operation === "resend" ? "Resend" : "Revoke"} failed: network_error`);
      return null;
    }
  }

  if (status !== "pending") {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={disabled} onClick={() => void resendInvitation()} type="button">
        {isSubmitting && !confirming ? "Resending..." : "Resend"}
      </Button>
      <button
        className={
          confirming
            ? "rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-black/20"
            : "rounded-xl border border-border bg-card shadow-xs px-3 py-2 text-sm font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground"
        }
        disabled={disabled}
        onClick={() => void revokeInvitation()}
        type="button"
      >
        {isSubmitting && confirming ? "Revoking..." : confirming ? "Confirm revoke" : "Revoke"}
      </button>
      {confirming ? (
        <Button variant="outline" onClick={() => { setConfirming(false); setMessage(null); }} type="button">
          Cancel
        </Button>
      ) : null}
      {message ? (
        <p className="min-w-0 text-xs leading-5 text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {fallbackLink ? (
        <a className="basis-full break-all text-xs font-semibold text-muted-foreground" href={fallbackLink}>
          Fallback invite link: {fallbackLink}
        </a>
      ) : null}
    </div>
  );
}

function resendMessage(delivery?: InvitationDelivery): string {
  if (!delivery) return "Invitation resent.";
  if (delivery.status === "sent") return `Invitation resent via ${delivery.provider}.`;
  if (delivery.status === "skipped") {
    return `Invitation rotated. Email delivery is not configured${delivery.reason ? `: ${delivery.reason}` : "."}`;
  }

  return `Invitation rotated, but delivery failed via ${delivery.provider}. Use the fallback link or try again from Ops.`;
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

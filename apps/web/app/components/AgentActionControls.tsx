"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type ActionStatus = "pending" | "approved" | "rejected" | "executed";
type Operation = "approve" | "reject" | "execute";

type AgentActionControlsProps = {
  actionId: string;
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  initialStatus: ActionStatus;
};

type ActionResponse =
  | {
      action: {
        status: ActionStatus;
      };
      runtime: "preview-route-handler" | "supabase-rpc";
    }
  | {
      error: string;
    };

export function AgentActionControls({
  actionId,
  actorUserId,
  authConfig,
  initialStatus
}: AgentActionControlsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ActionStatus>(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<Operation | null>(null);
  const [isRefreshing, startRefresh] = useTransition();
  const disabled = pendingOperation !== null || isRefreshing || status === "executed" || status === "rejected";
  const idempotencyPrefix = useMemo(() => stableId(), []);

  async function submit(operation: Operation) {
    setPendingOperation(operation);
    setMessage(null);

    try {
      const headers = await browserRouteHeaders({
        config: authConfig,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setMessage("Action failed: auth_required");
        return;
      }

      const response = await fetch(`/api/agent-actions/${encodeURIComponent(actionId)}/${operation}`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-${operation}-${Date.now()}`
        }
      });
      const body = (await response.json().catch(() => ({ error: "invalid_response" }))) as ActionResponse;

      if (!response.ok || "error" in body) {
        setMessage(`Action failed: ${"error" in body ? body.error : response.status}`);
        return;
      }

      setStatus(body.action.status);
      setMessage(successMessage(operation, body.action.status));
      if (body.runtime === "supabase-rpc") {
        startRefresh(() => router.refresh());
      }
    } catch {
      setMessage("Action failed: network_error");
    } finally {
      setPendingOperation(null);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex justify-start sm:justify-end">
        <span className="rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {status}
        </span>
      </div>
      <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
        <ActionButton
          disabled={disabled || status !== "pending"}
          label="Approve"
          loading={pendingOperation === "approve"}
          onClick={() => void submit("approve")}
          testId={`approve-${actionId}`}
          variant="secondary"
        />
        <ActionButton
          disabled={pendingOperation !== null || isRefreshing || status === "executed" || status === "rejected"}
          label="Reject"
          loading={pendingOperation === "reject"}
          onClick={() => void submit("reject")}
          testId={`reject-${actionId}`}
          variant="secondary"
        />
        <ActionButton
          disabled={disabled || status !== "approved"}
          label="Execute"
          loading={pendingOperation === "execute"}
          onClick={() => void submit("execute")}
          testId={`execute-${actionId}`}
          variant="primary"
        />
      </div>
      {message ? (
        <p className="max-w-xs text-left text-xs leading-5 text-muted-foreground sm:text-right" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  disabled,
  label,
  loading,
  onClick,
  testId,
  variant
}: {
  disabled: boolean;
  label: string;
  loading: boolean;
  onClick: () => void;
  testId: string;
  variant: "primary" | "secondary";
}) {
  const className =
    variant === "primary"
      ? "rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-black/20"
      : "rounded-xl border border-border bg-card shadow-xs px-3 py-2 text-sm font-semibold text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground";

  return (
    <button className={className} data-testid={testId} disabled={disabled} onClick={onClick} type="button">
      {loading ? "Working..." : label}
    </button>
  );
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function successMessage(operation: Operation, status: ActionStatus): string {
  if (operation === "approve") return "Approved. Execution is now available.";
  if (operation === "reject") return "Rejected. No execution will run.";
  if (operation === "execute") return "Executed. The audit trail records the action.";

  return `Updated to ${status}.`;
}

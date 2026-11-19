"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

/**
 * Ops-only: the goods shipped and delivery collapsed. The fault decision is the
 * quota decision (ADR 0028 D4): not the NGO's fault gives the company its unit
 * back, the NGO's fault does not. Before shipping use cancel instead.
 */
export function MatchFailureControls({
  actorUserId,
  authConfig,
  matchId
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  matchId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const prefix = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  async function submit(ngoAtFault: boolean) {
    setPending(ngoAtFault);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({ config: authConfig, contentTypeJson: true, previewUserId: actorUserId });
      if (authConfig && !headers.authorization) {
        setStatus("auth_required");
        return;
      }
      const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/failure`, {
        method: "POST",
        headers: { ...headers, "idempotency-key": `${prefix}-fail-${matchId}-${ngoAtFault}` },
        body: JSON.stringify({ ngoAtFault })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as { error?: string };
      if (!response.ok || payload.error) {
        setStatus(payload.error ?? String(response.status));
        return;
      }
      router.refresh();
    } catch {
      setStatus("network_error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-semibold text-muted-foreground">Delivery failed:</span>
      <Button variant="outline" disabled={pending !== null} onClick={() => void submit(false)} type="button">
        {pending === false ? "…" : "Not the NGO's fault · refund quota"}
      </Button>
      <Button variant="outline" disabled={pending !== null} onClick={() => void submit(true)} type="button">
        {pending === true ? "…" : "NGO at fault · no refund"}
      </Button>
      {status ? <span className="text-muted-foreground">{status}</span> : null}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

/** Remove a colleague from the company; their seat is free again. Asks once before acting. */
export function MemberRemoveControls({
  actorUserId,
  authConfig,
  memberId,
  memberName
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  memberId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const key = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  async function remove() {
    setPending(true);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({ config: authConfig, contentTypeJson: true, previewUserId: actorUserId });
      if (authConfig && !headers.authorization) {
        setStatus("auth_required");
        return;
      }
      const response = await fetch(`/api/members/${encodeURIComponent(memberId)}/remove`, {
        method: "POST",
        headers: { ...headers, "idempotency-key": `${key}-remove-${memberId}` },
        body: "{}"
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
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <button className="mt-2 text-xs font-semibold text-muted-foreground hover:underline" onClick={() => setConfirming(true)} type="button">
        Remove from team
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Remove {memberName}? They lose access to this workspace.</span>
      <Button variant="outline" disabled={pending} onClick={() => void remove()} type="button">
        {pending ? "…" : "Yes, remove"}
      </Button>
      <button className="font-semibold text-muted-foreground" disabled={pending} onClick={() => setConfirming(false)} type="button">
        Cancel
      </button>
      {status ? <span className="text-muted-foreground">{status}</span> : null}
    </div>
  );
}

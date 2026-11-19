"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DonationAllocation } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type ReleaseResponse = { allocation?: DonationAllocation; error?: string };

/**
 * NGO written release of an active claim (REQ-MATCH-09). Freed quantity returns
 * to the position pool.
 */
export function DonationAllocationReleaseControls({
  actorUserId,
  allocations,
  authConfig
}: {
  actorUserId: string;
  allocations: Array<DonationAllocation & { positionLabel: string; caseTitle: string }>;
  authConfig: SupabaseBrowserConfig | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const active = allocations.filter((item) => item.state === "active");
  if (active.length === 0) return null;

  async function release(allocationId: string) {
    const releaseNote = (notes[allocationId] ?? "").trim();
    if (!releaseNote) {
      setStatus("Write a short release note before releasing.");
      return;
    }
    setPendingId(allocationId);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setStatus("Sign in again — session missing.");
        return;
      }
      const response = await fetch(
        `/api/allocations/${encodeURIComponent(allocationId)}/release`,
        {
          method: "POST",
          headers: {
            ...headers,
            // One key per attempt: a cached failure (e.g. a network 503) must
            // not be replayed on the next click. Double submits are blocked by
            // `pendingId`; a repeat release of the same claim returns 409.
            "idempotency-key": `release-${allocationId}-${Date.now()}`
          },
          body: JSON.stringify({ releaseNote })
        }
      );
      const payload = (await response.json().catch(() => ({
        error: "invalid_response"
      }))) as ReleaseResponse;
      if (!response.ok || !payload.allocation) {
        setStatus(payload.error ?? `Release failed (${response.status})`);
        return;
      }
      setStatus("Claim released — quantity returned to the pool.");
      router.refresh();
    } catch {
      setStatus("Network error — try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Your allocations</h2>
        <p className="text-sm text-muted-foreground">
          Release a claim in writing if you cannot take the goods. Quantity returns to the
          company pool.
        </p>
      </div>
      <ul className="grid gap-3">
        {active.map((allocation) => (
          <li key={allocation.id} className="grid gap-2 border-b border-border/60 pb-3 last:border-0">
            <p className="text-sm text-foreground">
              {allocation.quantity} × {allocation.positionLabel}
              <span className="text-muted-foreground"> · {allocation.caseTitle}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-[14rem] flex-1"
                placeholder="Release note (required)"
                value={notes[allocation.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [allocation.id]: event.target.value }))
                }
              />
              <Button
                type="button"
                variant="outline"
                disabled={pendingId === allocation.id}
                onClick={() => void release(allocation.id)}
              >
                {pendingId === allocation.id ? "Releasing…" : "Release claim"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </section>
  );
}

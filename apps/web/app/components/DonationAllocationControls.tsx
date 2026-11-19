"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DonationAllocation } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type Option = { id: string; label: string; remaining?: number };
type AllocationResponse = { allocation?: DonationAllocation; error?: string };

/**
 * Ops controls to allocate confirmed position quantity to an NGO, plus the list
 * of current claims (REQ-MATCH-09). Only Ops allocates (ADR 0037); the owning
 * company sees the list read-only (`canAllocate` false).
 */
export function DonationAllocationControls({
  actorUserId,
  allocations,
  authConfig,
  canAllocate,
  caseConfirmed,
  caseId,
  ngoOptions,
  positionOptions
}: {
  actorUserId: string;
  allocations: Array<DonationAllocation & { ngoName: string; positionLabel: string }>;
  authConfig: SupabaseBrowserConfig | null;
  canAllocate: boolean;
  caseConfirmed: boolean;
  caseId: string;
  ngoOptions: Option[];
  positionOptions: Option[];
}) {
  const router = useRouter();
  const [positionId, setPositionId] = useState("");
  const [ngoId, setNgoId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => `alloc-${Date.now()}`, []);

  const selected = positionOptions.find((option) => option.id === positionId);

  async function submit() {
    setPending(true);
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
      const qty = Number(quantity);
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/allocations`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-${positionId}-${ngoId}-${Date.now()}`
        },
        body: JSON.stringify({ positionId, ngoId, quantity: qty })
      });
      const payload = (await response.json().catch(() => ({
        error: "invalid_response"
      }))) as AllocationResponse;
      if (!response.ok || !payload.allocation) {
        setStatus(payload.error ?? `Allocate failed (${response.status})`);
        return;
      }
      setPositionId("");
      setNgoId("");
      setQuantity("");
      setStatus(`Allocated ${payload.allocation.quantity} units.`);
      router.refresh();
    } catch {
      setStatus("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  if (!caseConfirmed) {
    return (
      <p className="text-sm text-muted-foreground">
        Confirm inventory before allocating positions to organisations.
      </p>
    );
  }

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Allocations</h2>
        <p className="text-sm text-muted-foreground">
          {canAllocate
            ? "Bind confirmed quantity to one organisation. Active claims count against the position; released quantity returns to the pool."
            : "sur.plus Ops allocates your confirmed positions to verified organisations. Claims appear here as they are made."}
        </p>
      </div>

      {!canAllocate ? null : positionOptions.length === 0 || ngoOptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {positionOptions.length === 0
            ? "No allocatable positions on this case."
            : "No verified organisations available to allocate to."}
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
            <span className="text-muted-foreground">Position</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={positionId}
              onChange={(event) => setPositionId(event.target.value)}
            >
              <option value="">Select…</option>
              {positionOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                  {option.remaining !== undefined ? ` · ${option.remaining} left` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-[12rem] flex-1 gap-1 text-sm">
            <span className="text-muted-foreground">Organisation</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={ngoId}
              onChange={(event) => setNgoId(event.target.value)}
            >
              <option value="">Select…</option>
              {ngoOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid w-28 gap-1 text-sm">
            <span className="text-muted-foreground">Quantity</span>
            <Input
              inputMode="numeric"
              placeholder={selected?.remaining?.toString() ?? "qty"}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <Button
            type="button"
            disabled={pending || !positionId || !ngoId || !quantity.trim()}
            onClick={() => void submit()}
          >
            {pending ? "Allocating…" : "Allocate"}
          </Button>
        </div>
      )}

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      {allocations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No allocations yet.</p>
      ) : (
        <ul className="grid gap-2 text-sm">
          {allocations.map((allocation) => (
            <li
              key={allocation.id}
              className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2 last:border-0"
            >
              <span>
                {allocation.quantity} × {allocation.positionLabel} → {allocation.ngoName}
              </span>
              <span className="text-muted-foreground">
                {allocation.state}
                {allocation.releaseNote ? ` · ${allocation.releaseNote}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

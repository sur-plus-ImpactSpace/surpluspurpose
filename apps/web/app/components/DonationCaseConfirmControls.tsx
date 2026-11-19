"use client";

import { Button } from "@/components/ui/button";
import type { DonationCase } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type ConfirmResponse = {
  donationCase?: DonationCase;
  error?: string;
};

export function DonationCaseConfirmControls({
  actorUserId,
  authConfig,
  caseId,
  confirmedAt,
  positionCount
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  caseId: string;
  confirmedAt: string | null;
  positionCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => `case-confirm-${Date.now()}`, []);

  if (confirmedAt) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Inventory confirmed
        {confirmedAt ? ` · ${new Date(confirmedAt).toLocaleString()}` : ""}. Adding or importing
        positions will reopen confirmation before Ops can allocate.
      </p>
    );
  }

  if (positionCount === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add at least one position before confirming this donation case.
      </p>
    );
  }

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
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/confirm`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-${Date.now()}`
        },
        body: "{}"
      });
      const payload = (await response.json().catch(() => ({
        error: "invalid_response"
      }))) as ConfirmResponse;
      if (!response.ok || !payload.donationCase) {
        setStatus(payload.error ?? `Confirm failed (${response.status})`);
        return;
      }
      setStatus("Inventory confirmed.");
      router.refresh();
    } catch {
      setStatus("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-foreground">Confirm inventory</h2>
        <p className="text-sm text-muted-foreground">
          Lock this list for allocation. Ops cannot allocate until you confirm.
        </p>
      </div>
      <Button type="button" disabled={pending} onClick={() => void submit()}>
        {pending ? "Confirming…" : "Confirm inventory"}
      </Button>
      {status ? <p className="basis-full text-sm text-muted-foreground">{status}</p> : null}
    </section>
  );
}

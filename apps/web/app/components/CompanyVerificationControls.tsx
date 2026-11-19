"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "approve" | "request_info" | "reject";

const ACTIONS: { action: Action; label: string }[] = [
  { action: "approve", label: "Approve" },
  { action: "request_info", label: "Request info" },
  { action: "reject", label: "Reject" }
];

/**
 * Ops-only verification actions for one company (ADR 0027 C1). Posts to the
 * admin-guarded route (cookie session → set_company_verification RPC), which
 * refuses to approve until a business proof exists. Refreshes on success.
 */
export function CompanyVerificationControls({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function submit(action: Action) {
    setPending(action);
    setStatus(null);
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/verification`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const payload = (await response.json().catch(() => ({}))) as { company?: unknown; error?: string };
      if (!response.ok || payload.error || !payload.company) {
        setStatus(`Action failed: ${payload.error ?? response.status}`);
        return;
      }
      router.refresh();
    } catch {
      setStatus("Action failed: network_error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 w-full">
      <div className="flex flex-wrap gap-3">
        {ACTIONS.map(({ action, label }) => (
          <Button className="h-12 min-w-36 flex-1 px-8 text-base font-semibold" size="lg" variant="outline" disabled={pending !== null} key={action} onClick={() => void submit(action)} type="button">
            {pending === action ? "…" : label}
          </Button>
        ))}
      </div>
      {status ? (
        <p className="mt-1.5 text-[0.7rem] text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

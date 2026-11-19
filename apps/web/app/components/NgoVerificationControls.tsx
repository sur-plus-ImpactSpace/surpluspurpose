"use client";

import { Button } from "@/components/ui/button";
import { NGO_PROOF_ASSESSMENT_PERIOD_YEARS_OPTIONS } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type Action = "approve" | "request_info" | "reject";
type VerificationResponse = { ngo?: { id: string; verificationState: string }; error?: string };

const ACTIONS: { action: Action; label: string; tone: "accept" | "neutral" | "reject" }[] = [
  { action: "approve", label: "Approve", tone: "accept" },
  { action: "request_info", label: "Request info", tone: "neutral" },
  { action: "reject", label: "Reject", tone: "reject" }
];

/**
 * Ops-only verification actions for one NGO application. Posts to the
 * verification route with an idempotency key; refreshes the queue on success.
 * Approve for notice-based org types requires notice date + assessment period
 * (REQ-NGO-06); public-law bodies skip those fields.
 */
export function NgoVerificationControls({
  actorUserId,
  authConfig,
  ngoId,
  requiresProofExpiry = true,
  initialNoticeDate = "",
  initialAssessmentPeriodYears = 5
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  ngoId: string;
  requiresProofExpiry?: boolean;
  initialNoticeDate?: string;
  initialAssessmentPeriodYears?: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [proofNoticeDate, setProofNoticeDate] = useState(initialNoticeDate);
  const [proofAssessmentPeriodYears, setProofAssessmentPeriodYears] = useState(
    initialAssessmentPeriodYears
  );
  const idempotencyPrefix = useMemo(() => stableId(), []);

  async function submit(action: Action) {
    setPending(action);
    setStatus(null);
    try {
      if (action === "approve" && requiresProofExpiry) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(proofNoticeDate)) {
          setStatus("Action failed: proof_validity_required");
          return;
        }
      }

      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setStatus("Action failed: auth_required");
        return;
      }

      const body: Record<string, unknown> = { action };
      if (action === "approve" && requiresProofExpiry) {
        body.proofNoticeDate = proofNoticeDate;
        body.proofAssessmentPeriodYears = proofAssessmentPeriodYears;
      }

      const response = await fetch(`/api/ngos/${encodeURIComponent(ngoId)}/verification`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-${action}-${Date.now()}`
        },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as VerificationResponse;

      if (!response.ok || payload.error || !payload.ngo) {
        setStatus(`Action failed: ${payload.error ?? response.status}`);
        return;
      }

      setStatus("Updated — refreshing…");
      router.refresh();
    } catch {
      setStatus("Action failed: network_error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3 w-full space-y-3">
      {requiresProofExpiry ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Notice date</span>
            <input
              className="h-10 rounded-md border border-border bg-background px-3"
              onChange={(event) => setProofNoticeDate(event.target.value)}
              type="date"
              value={proofNoticeDate}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Assessment period (years)</span>
            <select
              className="h-10 rounded-md border border-border bg-background px-3"
              onChange={(event) => setProofAssessmentPeriodYears(Number(event.target.value))}
              value={proofAssessmentPeriodYears}
            >
              {NGO_PROOF_ASSESSMENT_PERIOD_YEARS_OPTIONS.map((years) => (
                <option key={years} value={years}>
                  {years} years
                </option>
              ))}
            </select>
          </label>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Validity is derived from notice date + assessment period. Required to approve.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Public-law body — no tax-exemption notice expiry on this path.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {ACTIONS.map(({ action, label, tone }) => (
          <Button
            className={`h-12 min-w-36 flex-1 px-8 text-base font-semibold ${tone === "reject" ? "border-destructive/50 text-destructive hover:bg-destructive/10" : ""}`}
            disabled={pending !== null}
            key={action}
            onClick={() => void submit(action)}
            size="lg"
            type="button"
            variant={tone === "accept" ? "default" : "outline"}
          >
            {pending === action ? "Working…" : label}
          </Button>
        ))}
      </div>
      {status ? (
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

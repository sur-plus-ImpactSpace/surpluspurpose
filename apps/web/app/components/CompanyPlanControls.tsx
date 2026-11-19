"use client";

import { PLAN_TIERS, type PlanTier } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type PlanResponse = { company?: { id: string; plan: string }; error?: string };

/**
 * Ops-only plan control for one company. Until Stripe lands this is the
 * billing action: companies.plan is the only record of who pays, and moving
 * someone onto Seed used to mean writing SQL against production.
 */
export function CompanyPlanControls({
  actorUserId,
  authConfig,
  companyId,
  plan
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  companyId: string;
  plan: PlanTier;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PlanTier | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => stableId(), []);

  async function submit(next: PlanTier) {
    setPending(next);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setStatus("auth_required");
        return;
      }

      const response = await fetch(`/api/companies/${companyId}/plan`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-plan-${companyId}-${next}`
        },
        body: JSON.stringify({ plan: next })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as PlanResponse;

      if (!response.ok || payload.error || !payload.company) {
        setStatus(planErrorText(payload.error ?? String(response.status)));
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
    <div className="flex flex-wrap items-center gap-1.5">
      {PLAN_TIERS.map((tier) => {
        const active = tier === plan;

        return (
          <button
            className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary"
            }`}
            disabled={pending !== null || active}
            key={tier}
            onClick={() => void submit(tier)}
            type="button"
          >
            {pending === tier ? "…" : PLAN_LABEL[tier]}
          </button>
        );
      })}
      {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
    </div>
  );
}

const PLAN_LABEL: Record<PlanTier, string> = {
  registered: "Registered",
  seed: "Seed",
  tree: "Tree"
};

function planErrorText(reason: string): string {
  // The one error Ops can act on: remove members, then downgrade.
  if (reason === "seat_limit_exceeded") return "Too many members for that plan";
  if (reason === "forbidden" || reason === "actor_not_allowed") return "Ops only";
  return reason;
}

function stableId(): string {
  return Math.random().toString(36).slice(2, 10);
}

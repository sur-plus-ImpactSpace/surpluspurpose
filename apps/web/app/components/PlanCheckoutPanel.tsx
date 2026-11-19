"use client";

import { Button } from "@/components/ui/button";
import { PLAN_ENTITLEMENTS, PLAN_TIERS, type PaidPlanTier, type PlanTier } from "@surplus/domain";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

const LABEL: Record<PaidPlanTier, string> = { seed: "Seed", tree: "Tree" };

const ERRORS: Record<string, string> = {
  payments_not_configured: "Online payment is not available yet. Please contact us to activate a plan.",
  stripe_unavailable: "The payment page could not be opened. Please try again.",
  not_an_upgrade: "Your company already has this plan or a higher one.",
  rate_limit_exceeded: "Too many attempts. Please try again in a few minutes."
};

/**
 * Buy or upgrade a plan by card. Opens Stripe Checkout; the plan changes only
 * when Stripe's signed webhook confirms the payment, so coming back from the
 * payment page does not unlock anything by itself. Ops can still activate a plan
 * by hand. NGOs never see this: they are always free.
 */
export function PlanCheckoutPanel({
  actorUserId,
  authConfig,
  companyId,
  currentPlan
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  companyId: string;
  currentPlan: PlanTier;
}) {
  const [pending, setPending] = useState<PaidPlanTier | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const key = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const upgrades = (["seed", "tree"] as const).filter((plan) => PLAN_TIERS.indexOf(plan) > PLAN_TIERS.indexOf(currentPlan));

  if (upgrades.length === 0) return null;

  async function buy(plan: PaidPlanTier) {
    setPending(plan);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({ config: authConfig, contentTypeJson: true, previewUserId: actorUserId });
      if (authConfig && !headers.authorization) {
        setStatus("Please sign in again.");
        return;
      }
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/checkout`, {
        method: "POST",
        headers: { ...headers, "idempotency-key": `${key}-checkout-${plan}-${Date.now()}` },
        body: JSON.stringify({ plan })
      });
      const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setStatus(ERRORS[payload.error ?? ""] ?? "We could not start the payment. Please try again.");
        return;
      }
      window.location.assign(payload.url);
    } catch {
      setStatus("We could not start the payment. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <h2 className="text-lg font-semibold sm:text-xl">Your plan: {currentPlan === "registered" ? "Registered (free)" : LABEL[currentPlan]}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pay by card; the plan activates as soon as the payment is confirmed.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {upgrades.map((plan) => (
          <Button disabled={pending !== null} key={plan} onClick={() => void buy(plan)} type="button">
            {pending === plan ? "Opening payment…" : `${currentPlan === "registered" ? "Buy" : "Upgrade to"} ${LABEL[plan]}`}
            <span className="ml-2 font-normal opacity-80">
              {PLAN_ENTITLEMENTS[plan].matchesPerYear === null ? "unlimited matches" : `${PLAN_ENTITLEMENTS[plan].matchesPerYear} matches/year`}
            </span>
          </Button>
        ))}
      </div>
      {status ? (
        <p className="mt-3 text-sm text-muted-foreground" role="alert">
          {status}
        </p>
      ) : null}
    </section>
  );
}

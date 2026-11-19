"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type CheckResponse = { approved?: boolean; error?: string };

const inputClass =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm";

const ERRORS: Record<string, string> = {
  invalid_vat_id: "Please enter your EU VAT ID, for example DE123456789.",
  invalid_website: "Please enter your company website, for example acme-gmbh.de.",
  already_verified: "Your company is already verified.",
  company_rejected: "This company was rejected. Please contact support.",
  rate_limit_exceeded: "Too many attempts. Please try again in a few minutes."
};

/**
 * "Verify your company": VAT ID + website. The server checks VIES, the email
 * domain and the website; if everything passes the company is approved on the
 * spot, otherwise Ops reviews it (ADR 0027 C3).
 */
export function CompanyCheckForm({
  actorUserId,
  authConfig,
  companyId
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  companyId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"approved" | "review" | null>(null);
  const key = useMemo(() => Math.random().toString(36).slice(2, 12), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({ config: authConfig, contentTypeJson: true, previewUserId: actorUserId });
      if (authConfig && !headers.authorization) {
        setStatus("Please sign in again.");
        return;
      }
      const response = await fetch(`/api/companies/${encodeURIComponent(companyId)}/auto-check`, {
        method: "POST",
        headers: { ...headers, "idempotency-key": `${key}-${String(form.get("vatId"))}-${String(form.get("website"))}` },
        body: JSON.stringify({ vatId: String(form.get("vatId") ?? ""), website: String(form.get("website") ?? "") })
      });
      const payload = (await response.json().catch(() => ({}))) as CheckResponse;
      if (!response.ok || payload.error) {
        setStatus(ERRORS[payload.error ?? ""] ?? "We could not run the check. Please try again.");
        return;
      }
      setOutcome(payload.approved ? "approved" : "review");
      router.refresh();
    } catch {
      setStatus("We could not run the check. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (outcome) {
    return (
      <p className="mt-3 rounded-md border border-border bg-card px-3 py-2 text-sm" role="status">
        {outcome === "approved"
          ? "Your company is verified."
          : "Thanks. We could not confirm everything automatically, so our team will review your company."}
      </p>
    );
  }

  return (
    <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate onSubmit={(event) => void submit(event)}>
      <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
        EU VAT ID
        <input className={inputClass} maxLength={24} name="vatId" placeholder="DE123456789" required />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
        Company website
        <input className={inputClass} maxLength={300} name="website" placeholder="acme-gmbh.de" required />
      </label>
      <Button disabled={pending} type="submit">
        {pending ? "Checking…" : "Verify company"}
      </Button>
      {status ? (
        <p className="text-xs text-muted-foreground sm:col-span-3" role="alert">
          {status}
        </p>
      ) : null}
    </form>
  );
}

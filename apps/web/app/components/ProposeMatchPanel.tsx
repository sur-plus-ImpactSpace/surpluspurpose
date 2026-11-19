"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type Option = { id: string; label: string };
type ListingOption = Option & { quantity: number };
type NeedOption = Option & { open: number | null };
type ProposalResponse = { match?: { id: string }; error?: string };

/**
 * Ops-only: pick one open company offer and one open NGO need and propose them
 * as a match. Matching is curated (ADR 0028 D1); nothing is consumed until both
 * sides confirm.
 */
export function ProposeMatchPanel({
  actorUserId,
  authConfig,
  listings,
  needs
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  listings: ListingOption[];
  needs: NeedOption[];
}) {
  const router = useRouter();
  const [listingId, setListingId] = useState("");
  const [needId, setNeedId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => Math.random().toString(36).slice(2, 10), []);

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
        setStatus("auth_required");
        return;
      }

      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { ...headers, "idempotency-key": `${idempotencyPrefix}-propose-${listingId}-${needId}` },
        body: JSON.stringify({ listingId, needId, ...(quantity.trim() ? { quantity: Number(quantity) } : {}) })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as ProposalResponse;

      if (!response.ok || payload.error || !payload.match) {
        setStatus(proposalErrorText(payload.error ?? String(response.status)));
        return;
      }

      setListingId("");
      setNeedId("");
      setQuantity("");
      router.refresh();
    } catch {
      setStatus("network_error");
    } finally {
      setPending(false);
    }
  }

  const empty = listings.length === 0 || needs.length === 0;
  const listing = listings.find((option) => option.id === listingId);
  const need = needs.find((option) => option.id === needId);
  // What would be proposed without typing a number: the listing's amount, capped by what the need still wants.
  const defaultPart = listing ? Math.min(listing.quantity, need?.open ?? listing.quantity) : null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="text-lg font-semibold text-foreground">Propose a match</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pair an open company offer with an open NGO need — several companies can each cover part of one need.
        Both sides confirm before anything is committed.
      </p>
      {empty ? (
        <p className="mt-3 text-sm text-muted-foreground">Needs at least one open offer and one open need.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Offer
            <select
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm font-normal"
              onChange={(event) => setListingId(event.target.value)}
              value={listingId}
            >
              <option value="">Choose an offer…</option>
              {listings.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Need
            <select
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm font-normal"
              onChange={(event) => setNeedId(event.target.value)}
              value={needId}
            >
              <option value="">Choose a need…</option>
              {needs.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Quantity
            <Input
              
              inputMode="numeric"
              min={1}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={defaultPart === null ? "auto" : String(defaultPart)}
              type="number"
              value={quantity}
            />
          </label>
          <Button
 className="whitespace-nowrap"
 disabled={pending || !listingId || !needId}
 onClick={() => void submit()}
 type="button">
            {pending ? "…" : "Propose match"}
          </Button>
        </div>
      )}
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    </section>
  );
}

function proposalErrorText(reason: string): string {
  if (reason === "listing_not_open") return "That offer is already in a match";
  if (reason === "need_not_open") return "That need is already matched";
  if (reason === "match_exists") return "That pair was already proposed";
  if (reason === "need_fully_covered") return "That need is already fully covered by other parts";
  if (reason === "quantity_exceeds_open") return "That is more than the need still wants";
  if (reason === "quantity_exceeds_listing") return "That is more than the offer has";
  if (reason === "invalid_quantity") return "Enter a whole number above zero";
  if (reason === "company_not_verified") return "Verify the company first";
  if (reason === "ngo_not_verified") return "Verify the NGO first";
  if (reason === "forbidden" || reason === "actor_not_allowed") return "Ops only";
  return reason;
}

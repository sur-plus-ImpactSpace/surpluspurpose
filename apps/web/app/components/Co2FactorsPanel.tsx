"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type Row = { category: string; kgCo2ePerKg: number | null };

/**
 * Ops-only: the CO2 avoided per kg of goods, one factor per category. Impact
 * reports use the current values; categories without a factor fall back to the
 * figure stored on each match. Every change is audited with old and new value.
 */
export function Co2FactorsPanel({
  actorUserId,
  authConfig,
  rows
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  rows: Row[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const key = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  async function save(event: FormEvent<HTMLFormElement>, category: string) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get("factor") ?? "").trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0 || value > 1000) {
      setStatus(`${category}: enter a number from 0 to 1000 (kg CO₂e per kg)`);
      return;
    }
    setPending(category);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({ config: authConfig, contentTypeJson: true, previewUserId: actorUserId });
      if (authConfig && !headers.authorization) {
        setStatus("auth_required");
        return;
      }
      const response = await fetch("/api/co2-factors", {
        method: "POST",
        headers: { ...headers, "idempotency-key": `${key}-co2-${category}-${value}` },
        body: JSON.stringify({ category, kgCo2ePerKg: value })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as { error?: string };
      if (!response.ok || payload.error) {
        setStatus(`${category}: ${payload.error ?? response.status}`);
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
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="text-lg font-semibold text-foreground">CO₂ factors</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        kg CO₂e avoided per kg of goods, per category. Impact reports use these values; a category without one uses the
        figure stored on each match.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((row) => (
            <li className="py-2" key={row.category}>
              <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={(event) => void save(event, row.category)}>
                <span className="min-w-40 font-semibold">{row.category}</span>
                <Input
                  className="w-28"
                  defaultValue={row.kgCo2ePerKg ?? ""}
                  inputMode="decimal"
                  name="factor"
                  placeholder="not set"
                />
                <span className="text-xs text-muted-foreground">kg CO₂e / kg</span>
                <Button variant="outline" size="sm" disabled={pending !== null} type="submit">
                  {pending === row.category ? "…" : "Save"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
    </section>
  );
}

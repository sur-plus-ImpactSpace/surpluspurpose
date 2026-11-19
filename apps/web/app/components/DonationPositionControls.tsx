"use client";

import { Button } from "@/components/ui/button";
import { parseDonationPositionCsv, type DonationPosition } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import { CATEGORIES } from "../lib/catalog";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

const EMPTY_POSITION = {
  category: "",
  model: "",
  quantity: "",
  condition: "",
  provenance: ""
};

export function DonationPositionControls({
  caseId,
  actorUserId,
  authConfig,
  positions
}: {
  caseId: string;
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  positions: DonationPosition[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(EMPTY_POSITION);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => `pos-${Date.now()}`, []);

  function setField(name: keyof typeof EMPTY_POSITION, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function addPosition() {
    const quantity = Number(form.quantity);
    if (
      !form.category.trim() ||
      !form.model.trim() ||
      !form.condition.trim() ||
      !form.provenance.trim() ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setStatus("Fill category, model, quantity, condition and provenance.");
      return;
    }
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
      const response = await fetch(`/api/cases/${caseId}/positions`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-pos-${Date.now()}`
        },
        body: JSON.stringify({
          category: form.category.trim(),
          model: form.model.trim(),
          quantity,
          condition: form.condition.trim(),
          provenance: form.provenance.trim()
        })
      });
      const payload = (await response.json().catch(() => ({
        error: "invalid_response"
      }))) as { error?: string };
      if (!response.ok) {
        setStatus(payload.error ?? `Add failed (${response.status})`);
        return;
      }
      setForm(EMPTY_POSITION);
      setStatus("Position added.");
      router.refresh();
    } catch {
      setStatus("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  async function onCsvSelected(file: File | null) {
    if (!file) return;
    setPending(true);
    setStatus(null);
    try {
      const text = await file.text();
      const parsed = parseDonationPositionCsv(text);
      if (!parsed.ok) {
        setStatus(parsed.reason === "empty_csv" ? "CSV is empty." : "No valid rows in CSV.");
        return;
      }
      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setStatus("Sign in again — session missing.");
        return;
      }
      const response = await fetch(`/api/cases/${caseId}/positions/import`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-import-${Date.now()}`
        },
        body: JSON.stringify({ positions: parsed.positions })
      });
      const payload = (await response.json().catch(() => ({
        error: "invalid_response"
      }))) as { error?: string; positions?: DonationPosition[] };
      if (!response.ok) {
        setStatus(payload.error ?? `Import failed (${response.status})`);
        return;
      }
      setStatus(`Imported ${payload.positions?.length ?? parsed.positions.length} positions.`);
      router.refresh();
    } catch {
      setStatus("Could not read or import that file.");
    } finally {
      setPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Condition</th>
              <th className="px-3 py-2 font-medium">Provenance</th>
              <th className="px-3 py-2 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                  No positions yet — add one or import a CSV.
                </td>
              </tr>
            ) : (
              positions.map((position) => (
                <tr key={position.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{position.model}</td>
                  <td className="px-3 py-2 text-muted-foreground">{position.category}</td>
                  <td className="px-3 py-2">{position.quantity}</td>
                  <td className="px-3 py-2">{position.condition}</td>
                  <td className="px-3 py-2 text-muted-foreground">{position.provenance}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{position.state}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Add position</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Category</span>
            <select
              className="rounded-md border border-border bg-background px-3 py-2"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
            >
              <option value="">Select…</option>
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.en}>
                  {category.en}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Model</span>
            <input
              className="rounded-md border border-border bg-background px-3 py-2"
              value={form.model}
              onChange={(e) => setField("model", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Quantity</span>
            <input
              className="rounded-md border border-border bg-background px-3 py-2"
              inputMode="numeric"
              value={form.quantity}
              onChange={(e) => setField("quantity", e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Condition</span>
            <input
              className="rounded-md border border-border bg-background px-3 py-2"
              value={form.condition}
              onChange={(e) => setField("condition", e.target.value)}
              placeholder="Good / Fair / New…"
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Provenance</span>
            <input
              className="rounded-md border border-border bg-background px-3 py-2"
              value={form.provenance}
              onChange={(e) => setField("provenance", e.target.value)}
              placeholder="Where these items come from"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={pending} onClick={() => void addPosition()}>
            {pending ? "Saving…" : "Add position"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void onCsvSelected(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => fileRef.current?.click()}
          >
            Import CSV
          </Button>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          CSV columns: category/kategorie, model/modell, quantity/menge, condition/zustand,
          provenance/herkunft (brand+title also map to model).
        </p>
      </section>
    </div>
  );
}

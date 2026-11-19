"use client";

import { Button } from "@/components/ui/button";
import type { DonationCase } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import { COUNTRIES } from "../lib/catalog";
import type { Locale } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type CaseResponse = {
  donationCase?: DonationCase;
  error?: string;
};

const EMPTY_FORM = {
  title: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  city: "",
  country: "",
  locationNotes: "",
  timeWindow: "",
  availableFrom: "",
  availableUntil: ""
};

export function DonationCaseCreateForm({
  actorUserId,
  authConfig,
  defaultOpen = false
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  defaultOpen?: boolean;
  locale?: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => `case-${Date.now()}`, []);

  const requiredComplete =
    form.title.trim() &&
    form.contactName.trim() &&
    form.contactEmail.trim() &&
    form.city.trim() &&
    form.country.trim();

  function setField(name: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    if (!requiredComplete) {
      setStatus("Fill title, contact and location first.");
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
      // Idempotency key is an HTTP header: keep it ASCII-only (no title text).
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-${Date.now()}`
        },
        body: JSON.stringify({
          title: form.title.trim(),
          contactName: form.contactName.trim(),
          contactEmail: form.contactEmail.trim(),
          contactPhone: form.contactPhone.trim() || null,
          city: form.city.trim(),
          country: form.country.trim(),
          locationNotes: form.locationNotes.trim() || null,
          timeWindow: form.timeWindow.trim() || null,
          availableFrom: form.availableFrom || null,
          availableUntil: form.availableUntil || null
        })
      });
      const payload = (await response.json().catch(() => ({
        error: "invalid_response"
      }))) as CaseResponse;
      if (!response.ok || !payload.donationCase) {
        setStatus(payload.error ?? `Create failed (${response.status})`);
        return;
      }
      setForm(EMPTY_FORM);
      setOpen(false);
      router.push(`/cases/${payload.donationCase.id}`);
      router.refresh();
    } catch {
      setStatus("Network error — try again.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New donation case
      </Button>
    );
  }

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">New donation case</h2>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Title</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Munich office move — Q2 surplus"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Contact name</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            value={form.contactName}
            onChange={(e) => setField("contactName", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Contact email</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            type="email"
            value={form.contactEmail}
            onChange={(e) => setField("contactEmail", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Phone (optional)</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            value={form.contactPhone}
            onChange={(e) => setField("contactPhone", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Time window</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            value={form.timeWindow}
            onChange={(e) => setField("timeWindow", e.target.value)}
            placeholder="Weekdays 09:00–16:00"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">City</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            value={form.city}
            onChange={(e) => setField("city", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Country</span>
          <select
            className="rounded-md border border-border bg-background px-3 py-2"
            value={form.country}
            onChange={(e) => setField("country", e.target.value)}
          >
            <option value="">Select…</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="text-muted-foreground">Location notes</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            value={form.locationNotes}
            onChange={(e) => setField("locationNotes", e.target.value)}
            placeholder="Loading bay, gate code…"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Available from</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            type="date"
            value={form.availableFrom}
            onChange={(e) => setField("availableFrom", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Available until</span>
          <input
            className="rounded-md border border-border bg-background px-3 py-2"
            type="date"
            value={form.availableUntil}
            onChange={(e) => setField("availableUntil", e.target.value)}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending || !requiredComplete} onClick={() => void submit()}>
          {pending ? "Creating…" : "Create case"}
        </Button>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </div>
    </section>
  );
}

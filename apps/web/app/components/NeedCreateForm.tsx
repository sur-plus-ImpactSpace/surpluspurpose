"use client";

import { Button } from "@/components/ui/button";
import {
  STORY_MIN_WORDS,
  countWords,
  type Need,
  type NeedDeliveryPreference,
  type NeedUrgency
} from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import { CATEGORIES, COUNTRIES, subcategoriesFor } from "../lib/catalog";
import { getDictionary, type Locale } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type NeedResponse = {
  need?: Need;
  runtime?: "preview-route-handler" | "supabase-rpc";
  error?: string;
};

const EMPTY_FORM = {
  title: "",
  category: "",
  subcategory: "",
  quantity: "",
  quantityOpen: false,
  maxQuantityPerMatch: "",
  urgency: "flexible" as NeedUrgency,
  city: "",
  country: "",
  targetDate: "",
  beneficiaries: "",
  targetGroup: "",
  deliveryPreference: "either" as NeedDeliveryPreference,
  deliveryAddress: "",
  hasVehicle: false,
  story: ""
};

/**
 * Wording taken from what NGOs actually chose in the real submissions rather
 * than from what a date picker wants. Labels are resolved per locale at render.
 */
const URGENCY_VALUES: NeedUrgency[] = ["asap", "flexible", "by_date", "ongoing"];
const DELIVERY_VALUES: NeedDeliveryPreference[] = ["collect", "ship", "either"];

export function NeedCreateForm({
  actorUserId,
  authConfig,
  defaultOpen = false,
  locale = "en"
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  /** Open the form on first render (used by the onboarding empty state). */
  defaultOpen?: boolean;
  locale?: Locale;
}) {
  const dict = getDictionary(locale).forms;
  const t = dict.need;
  const tc = dict.common;
  const urgencyLabels: Record<NeedUrgency, string> = {
    asap: t.urgencyAsap,
    flexible: t.urgencyFlexible,
    by_date: t.urgencyByDate,
    ongoing: t.urgencyOngoing
  };
  const deliveryLabels: Record<NeedDeliveryPreference, string> = {
    collect: t.deliveryCollect,
    ship: t.deliveryShip,
    either: t.deliveryEither
  };
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => stableId(), []);

  const storyWords = countWords(form.story);
  const requiredComplete =
    form.title.trim() &&
    form.category.trim() &&
    form.subcategory.trim() &&
    form.city.trim() &&
    form.country.trim() &&
    form.targetGroup.trim() &&
    form.deliveryAddress.trim() &&
    storyWords >= STORY_MIN_WORDS &&
    (form.urgency !== "by_date" || form.targetDate.trim());

  function setField(name: keyof typeof EMPTY_FORM, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    // Optional on purpose: "Laptops", "as many as you have" and "3-5" are all
    // real answers from real NGOs. Only validate a number that was given.
    const hasQuantity = form.quantity.trim().length > 0;
    const quantity = hasQuantity ? Number(form.quantity) : undefined;
    if (hasQuantity && (!Number.isFinite(quantity) || (quantity ?? 0) <= 0)) {
      setStatus(`${t.heading} ${tc.failedPrefix} ${t.errQuantityPositive}`);
      return;
    }
    const beneficiaries = form.beneficiaries.trim() ? Number(form.beneficiaries) : undefined;
    if (beneficiaries !== undefined && (!Number.isFinite(beneficiaries) || beneficiaries < 0)) {
      setStatus(`${t.heading} ${tc.failedPrefix} ${t.errBeneficiariesNonNegative}`);
      return;
    }
    const hasMaxPerMatch = form.maxQuantityPerMatch.trim().length > 0;
    const maxQuantityPerMatch = hasMaxPerMatch ? Number(form.maxQuantityPerMatch) : undefined;
    if (
      hasMaxPerMatch &&
      (!Number.isInteger(maxQuantityPerMatch) || (maxQuantityPerMatch ?? 0) <= 0)
    ) {
      setStatus(`${t.heading} ${tc.failedPrefix} ${t.errMaxPerMatchPositive}`);
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
        setStatus(`${t.heading} ${tc.failedPrefix} ${tc.authRequired}`);
        return;
      }

      const response = await fetch("/api/needs", {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-need-${Date.now()}`
        },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category.trim(),
          subcategory: form.subcategory.trim() || undefined,
          quantity,
          quantityOpen: form.quantityOpen,
          maxQuantityPerMatch,
          urgency: form.urgency,
          city: form.city.trim(),
          country: form.country.trim(),
          targetDate: form.urgency === "by_date" ? form.targetDate.trim() : undefined,
          beneficiaries,
          targetGroup: form.targetGroup.trim(),
          deliveryPreference: form.deliveryPreference,
          deliveryAddress: form.deliveryAddress.trim(),
          hasVehicle: form.hasVehicle,
          story: form.story.trim()
        })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as NeedResponse;

      if (!response.ok || payload.error || !payload.need) {
        setStatus(`${t.heading} ${tc.failedPrefix} ${payload.error ?? response.status}`);
        return;
      }

      setForm(EMPTY_FORM);
      setStatus(t.posted);
      router.refresh();
    } catch {
      setStatus(`${t.heading} ${tc.failedPrefix} ${tc.networkError}`);
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card shadow-xs p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t.eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold">{t.heading}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t.leadCollapsed}</p>
        </div>
        <Button
 className="shrink-0"
 onClick={() => setOpen(true)}
 type="button">
          {t.addButton}
        </Button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold">{t.heading}</h2>
        </div>
        <button
          className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setOpen(false)}
          type="button"
        >
          {tc.close}
        </button>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t.lead}</p>

      <div className="mt-4 grid gap-3">
        <Field label={t.title} htmlFor="need-title">
          <input
            className={inputClass}
            disabled={pending}
            id="need-title"
            maxLength={120}
            onChange={(event) => setField("title", event.target.value)}
            placeholder={t.titlePlaceholder}
            value={form.title}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tc.category} htmlFor="need-category">
            <select
              className={inputClass}
              disabled={pending}
              id="need-category"
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value, subcategory: "" }))}
              value={form.category}
            >
              <option value="">{tc.selectCategory}</option>
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category[locale]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tc.subcategory} htmlFor="need-subcategory">
            <select
              className={inputClass}
              disabled={pending || !form.category}
              id="need-subcategory"
              onChange={(event) => setField("subcategory", event.target.value)}
              value={form.subcategory}
            >
              <option value="">
                {form.category ? tc.selectSubcategory : tc.chooseCategoryFirst}
              </option>
              {subcategoriesFor(form.category).map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub[locale]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.howMany} htmlFor="need-quantity" optional optionalLabel={tc.optional}>
            <input
              className={inputClass}
              disabled={pending || form.quantityOpen}
              id="need-quantity"
              inputMode="numeric"
              min={1}
              onChange={(event) => setField("quantity", event.target.value)}
              placeholder={t.howManyPlaceholder}
              type="number"
              value={form.quantityOpen ? "" : form.quantity}
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" htmlFor="need-quantity-open">
              <input
                checked={form.quantityOpen}
                className="h-4 w-4 accent-primary"
                disabled={pending}
                id="need-quantity-open"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    quantityOpen: event.target.checked,
                    quantity: event.target.checked ? "" : current.quantity
                  }))
                }
                type="checkbox"
              />
              {t.anyAmount}
            </label>
          </Field>
          <Field label={t.maxPerMatch} htmlFor="need-max-per-match" optional optionalLabel={tc.optional}>
            <input
              className={inputClass}
              disabled={pending}
              id="need-max-per-match"
              inputMode="numeric"
              min={1}
              onChange={(event) => setField("maxQuantityPerMatch", event.target.value)}
              placeholder={t.maxPerMatchPlaceholder}
              type="number"
              value={form.maxQuantityPerMatch}
            />
            <p className="mt-1 text-xs text-muted-foreground">{t.maxPerMatchHint}</p>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tc.city} htmlFor="need-city">
            <input
              className={inputClass}
              disabled={pending}
              id="need-city"
              onChange={(event) => setField("city", event.target.value)}
              placeholder={tc.cityPlaceholder}
              value={form.city}
            />
          </Field>
          <Field label={tc.country} htmlFor="need-country">
            <select
              className={inputClass}
              disabled={pending}
              id="need-country"
              onChange={(event) => setField("country", event.target.value)}
              value={form.country}
            >
              <option value="">{tc.selectCountry}</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={t.deliveryAddress} htmlFor="need-delivery-address">
          <input
            className={inputClass}
            disabled={pending}
            id="need-delivery-address"
            onChange={(event) => setField("deliveryAddress", event.target.value)}
            placeholder={t.deliveryAddressPlaceholder}
            value={form.deliveryAddress}
          />
          <p className="mt-1 text-xs text-muted-foreground">{t.deliveryAddressHint}</p>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.deliveryPreference} htmlFor="need-delivery-preference">
            <select
              className={inputClass}
              disabled={pending}
              id="need-delivery-preference"
              onChange={(event) => {
                const deliveryPreference = event.target.value as NeedDeliveryPreference;
                setForm((current) => ({
                  ...current,
                  deliveryPreference,
                  hasVehicle: deliveryPreference === "ship" ? false : current.hasVehicle
                }));
              }}
              value={form.deliveryPreference}
            >
              {DELIVERY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {deliveryLabels[value]}
                </option>
              ))}
            </select>
            <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground" htmlFor="need-has-vehicle">
              <input
                checked={form.hasVehicle}
                className="h-4 w-4 accent-primary"
                disabled={pending || form.deliveryPreference === "ship"}
                id="need-has-vehicle"
                onChange={(event) => setField("hasVehicle", event.target.checked)}
                type="checkbox"
              />
              {t.hasVehicle}
            </label>
          </Field>
          <Field label={t.targetGroup} htmlFor="need-target-group">
            <input
              className={inputClass}
              disabled={pending}
              id="need-target-group"
              onChange={(event) => setField("targetGroup", event.target.value)}
              placeholder={t.targetGroupPlaceholder}
              value={form.targetGroup}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.whenNeeded} htmlFor="need-urgency">
            <select
              className={inputClass}
              disabled={pending}
              id="need-urgency"
              onChange={(event) => setField("urgency", event.target.value as NeedUrgency)}
              value={form.urgency}
            >
              {URGENCY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {urgencyLabels[value]}
                </option>
              ))}
            </select>
            {form.urgency === "by_date" ? (
              <input
                aria-label={t.neededByDateAria}
                className={`${inputClass} mt-2`}
                disabled={pending}
                onChange={(event) => setField("targetDate", event.target.value)}
                type="date"
                value={form.targetDate}
              />
            ) : null}
          </Field>
          <Field label={t.peopleReached} htmlFor="need-beneficiaries" optional optionalLabel={tc.optional}>
            <input
              className={inputClass}
              disabled={pending}
              id="need-beneficiaries"
              inputMode="numeric"
              min={0}
              onChange={(event) => setField("beneficiaries", event.target.value)}
              placeholder={t.peopleReachedPlaceholder}
              type="number"
              value={form.beneficiaries}
            />
          </Field>
        </div>

        {/*
          Required, and placed with room to breathe. In the real submissions
          this is the field that does the work: it is what makes a corporate
          choose one need over another, and it is what the impact and CSRD
          narrative is written from later.
        */}
        <Field label={t.story} htmlFor="need-story">
          <textarea
            className={`${inputClass} min-h-28 resize-y leading-6`}
            disabled={pending}
            id="need-story"
            maxLength={1000}
            onChange={(event) => setField("story", event.target.value)}
            placeholder={t.storyPlaceholder}
            value={form.story}
          />
          <p
            className={`mt-1 text-xs ${
              storyWords >= STORY_MIN_WORDS ? "text-muted-foreground" : "text-muted-foreground"
            }`}
          >
            {storyWords >= STORY_MIN_WORDS
              ? `${storyWords} ${t.words}`
              : `${t.atLeast} ${STORY_MIN_WORDS} ${t.wordsShort} — ${storyWords} ${t.soFar}`}
          </p>
        </Field>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button disabled={pending || !requiredComplete} onClick={() => void submit()} type="button">
            {pending ? t.submitPending : t.submit}
          </Button>
        </div>
        {status ? (
          <p className="text-sm text-muted-foreground" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-base text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:[color-scheme:dark] md:text-sm";

function Field({
  children,
  htmlFor,
  label,
  optional,
  optionalLabel
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
  optional?: boolean;
  optionalLabel?: string;
}) {
  return (
    <div className="grid gap-1">
      <label className="text-sm font-semibold text-muted-foreground" htmlFor={htmlFor}>
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-muted-foreground">{optionalLabel ?? "(optional)"}</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

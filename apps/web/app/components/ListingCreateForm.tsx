"use client";

import { Button } from "@/components/ui/button";
import type { Listing } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import { CATEGORIES, COUNTRIES, subcategoriesFor, suggestCategory } from "../lib/catalog";
import { getDictionary, type Locale } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type ListingResponse = {
  listing?: Listing;
  runtime?: "preview-route-handler" | "supabase-rpc";
  error?: string;
};

type EligibilityKey = "usable" | "policyFit" | "ownership";

const ELIGIBILITY_KEYS: EligibilityKey[] = ["usable", "policyFit", "ownership"];

const EMPTY_FORM = {
  title: "",
  category: "",
  subcategory: "",
  quantity: "",
  unit: "",
  unitValue: "",
  city: "",
  country: "",
  condition: "",
  availableUntil: "",
  pickupWindow: "",
  packaging: "",
  weightKg: "",
  categoryDetails: ""
};

export function ListingCreateForm({
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
  const t = dict.listing;
  const tc = dict.common;
  const eligibilityLabels: Record<EligibilityKey, string> = {
    usable: t.eligibilityUsable,
    policyFit: t.eligibilityPolicyFit,
    ownership: t.eligibilityOwnership
  };
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [form, setForm] = useState(EMPTY_FORM);
  const [eligibility, setEligibility] = useState<Record<EligibilityKey, boolean>>({
    usable: false,
    policyFit: false,
    ownership: false
  });
  const [showOptional, setShowOptional] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => stableId(), []);

  const eligibilityComplete = ELIGIBILITY_KEYS.every((key) => eligibility[key]);
  const requiredComplete =
    form.title.trim() &&
    form.category.trim() &&
    form.subcategory.trim() &&
    form.quantity.trim() &&
    form.unitValue.trim() &&
    form.city.trim() &&
    form.country.trim() &&
    form.condition.trim();

  function setField(name: keyof typeof EMPTY_FORM, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    const quantity = Number(form.quantity);
    const unitValue = Number(form.unitValue);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setStatus(`${t.heading} ${tc.failedPrefix} ${t.errQuantityPositive}`);
      return;
    }
    if (!Number.isFinite(unitValue) || unitValue < 0) {
      setStatus(`${t.heading} ${tc.failedPrefix} ${t.errUnitValueNonNegative}`);
      return;
    }
    const weightKg = form.weightKg.trim() ? Number(form.weightKg) : undefined;
    if (weightKg !== undefined && !Number.isFinite(weightKg)) {
      setStatus(`${t.heading} ${tc.failedPrefix} ${t.errWeightNumber}`);
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

      const response = await fetch("/api/listings", {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-listing-${Date.now()}`
        },
        body: JSON.stringify({
          title: form.title.trim(),
          category: form.category.trim(),
          quantity,
          unitValue,
          city: form.city.trim(),
          country: form.country.trim(),
          condition: form.condition.trim(),
          subcategory: form.subcategory.trim() || undefined,
          unit: form.unit.trim() || undefined,
          availableUntil: form.availableUntil.trim() || undefined,
          pickupWindow: form.pickupWindow.trim() || undefined,
          packaging: form.packaging.trim() || undefined,
          weightKg,
          categoryDetails: form.categoryDetails.trim() || undefined,
          eligibility
        })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as ListingResponse;

      if (!response.ok || payload.error || !payload.listing) {
        setStatus(`${t.heading} ${tc.failedPrefix} ${payload.error ?? response.status}`);
        return;
      }

      setForm(EMPTY_FORM);
      setEligibility({ usable: false, policyFit: false, ownership: false });
      setShowOptional(false);
      setStatus(t.created);
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
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.lead}</p>

      <div className="mt-4 grid gap-3">
        <Field label={t.title} htmlFor="listing-title">
          <input
            className={inputClass}
            disabled={pending}
            id="listing-title"
            maxLength={120}
            onChange={(event) => {
              const title = event.target.value;
              setForm((current) => {
                // Auto-suggest the category from the title ("laptop" -> IT).
                // Only while the user has not chosen one themselves — a typed
                // category is never overwritten.
                const nextCategory =
                  current.category && current.category !== suggestCategory(current.title)
                    ? current.category
                    : suggestCategory(title) ?? current.category;
                // A changed category invalidates the chosen subcategory.
                const subcategory = nextCategory === current.category ? current.subcategory : "";

                return { ...current, title, category: nextCategory, subcategory };
              });
            }}
            placeholder={t.titlePlaceholder}
            value={form.title}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tc.category} htmlFor="listing-category">
            <select
              className={inputClass}
              disabled={pending}
              id="listing-category"
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
          <Field label={tc.subcategory} htmlFor="listing-subcategory">
            <select
              className={inputClass}
              disabled={pending || !form.category}
              id="listing-subcategory"
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
          <Field label={t.condition} htmlFor="listing-condition">
            <input
              className={inputClass}
              disabled={pending}
              id="listing-condition"
              list="listing-condition-options"
              onChange={(event) => setField("condition", event.target.value)}
              placeholder={t.conditionPlaceholder}
              value={form.condition}
            />
            <datalist id="listing-condition-options">
              <option value={t.conditionNew} />
              <option value={t.conditionLikeNew} />
              <option value={t.conditionGoodUsed} />
              <option value={t.conditionFunctionalWorn} />
            </datalist>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t.quantity} htmlFor="listing-quantity">
            <input
              className={inputClass}
              disabled={pending}
              id="listing-quantity"
              inputMode="decimal"
              min={1}
              onChange={(event) => setField("quantity", event.target.value)}
              placeholder={t.quantityPlaceholder}
              type="number"
              value={form.quantity}
            />
          </Field>
          <Field label={t.unit} htmlFor="listing-unit" optional optionalLabel={tc.optional}>
            <input
              className={inputClass}
              disabled={pending}
              id="listing-unit"
              onChange={(event) => setField("unit", event.target.value)}
              placeholder={t.unitPlaceholder}
              value={form.unit}
            />
          </Field>
          <Field label={t.unitValue} htmlFor="listing-unit-value">
            <input
              className={inputClass}
              disabled={pending}
              id="listing-unit-value"
              inputMode="decimal"
              min={0}
              onChange={(event) => setField("unitValue", event.target.value)}
              placeholder={t.unitValuePlaceholder}
              type="number"
              value={form.unitValue}
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tc.city} htmlFor="listing-city">
            <input
              className={inputClass}
              disabled={pending}
              id="listing-city"
              onChange={(event) => setField("city", event.target.value)}
              placeholder={tc.cityPlaceholder}
              value={form.city}
            />
          </Field>
          <Field label={tc.country} htmlFor="listing-country">
            <select
              className={inputClass}
              disabled={pending}
              id="listing-country"
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

        <button
          className="justify-self-start text-sm font-semibold text-primary underline-offset-2 hover:underline"
          onClick={() => setShowOptional((current) => !current)}
          type="button"
        >
          {showOptional ? t.hideOptional : t.showOptional}
        </button>

        {showOptional ? (
          <div className="grid gap-3 rounded-lg border border-border bg-muted p-4">
            <Field label={t.availableUntil} htmlFor="listing-available-until" optional optionalLabel={tc.optional}>
              <input
                className={inputClass}
                disabled={pending}
                id="listing-available-until"
                onChange={(event) => setField("availableUntil", event.target.value)}
                type="date"
                value={form.availableUntil}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t.pickupWindow} htmlFor="listing-pickup-window" optional optionalLabel={tc.optional}>
                <input
                  className={inputClass}
                  disabled={pending}
                  id="listing-pickup-window"
                  onChange={(event) => setField("pickupWindow", event.target.value)}
                  placeholder={t.pickupWindowPlaceholder}
                  value={form.pickupWindow}
                />
              </Field>
              <Field label={t.packaging} htmlFor="listing-packaging" optional optionalLabel={tc.optional}>
                <input
                  className={inputClass}
                  disabled={pending}
                  id="listing-packaging"
                  onChange={(event) => setField("packaging", event.target.value)}
                  placeholder={t.packagingPlaceholder}
                  value={form.packaging}
                />
              </Field>
              <Field label={t.weightKg} htmlFor="listing-weight" optional optionalLabel={tc.optional}>
                <input
                  className={inputClass}
                  disabled={pending}
                  id="listing-weight"
                  inputMode="decimal"
                  min={0}
                  onChange={(event) => setField("weightKg", event.target.value)}
                  placeholder={t.weightPlaceholder}
                  type="number"
                  value={form.weightKg}
                />
              </Field>
            </div>
            <Field label={t.categoryDetails} htmlFor="listing-category-details" optional optionalLabel={tc.optional}>
              <textarea
                className={`${inputClass} min-h-20 resize-y leading-6`}
                disabled={pending}
                id="listing-category-details"
                maxLength={1000}
                onChange={(event) => setField("categoryDetails", event.target.value)}
                placeholder={t.categoryDetailsPlaceholder}
                value={form.categoryDetails}
              />
            </Field>
          </div>
        ) : null}

        <fieldset className="grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <legend className="px-1 text-xs font-medium text-primary">
            {t.eligibilityLegend}
          </legend>
          {ELIGIBILITY_KEYS.map((key) => (
            <label className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" key={key}>
              <input
                checked={eligibility[key]}
                className="mt-1 accent-primary"
                disabled={pending}
                onChange={(event) =>
                  setEligibility((current) => ({ ...current, [key]: event.target.checked }))
                }
                type="checkbox"
              />
              {eligibilityLabels[key]}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {eligibilityComplete ? t.eligibilityConfirmed : t.eligibilityPending}
          </p>
          <Button disabled={pending || !requiredComplete || !eligibilityComplete} onClick={() => void submit()} type="button">
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

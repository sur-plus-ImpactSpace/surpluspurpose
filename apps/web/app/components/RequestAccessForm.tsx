"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField, FormTextarea } from "./FormField";
import { Building2, Heart } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { Dictionary } from "../lib/i18n";
import { CheckField } from "./CheckField";

type Copy = Dictionary["requestAccess"];
type Role = "" | "corporate" | "ngo";

/**
 * Public "Request access" form. Posts to /api/access-requests without a
 * session; the hidden `website` field is a honeypot that real visitors never
 * fill in.
 */
export function RequestAccessForm({ copy }: { copy: Copy }) {
  const [role, setRole] = useState<Role>("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"name" | "organization" | "role" | "email" | "consent", string>>>({});
  const clear = (key: keyof typeof errors) => setErrors((current) => ({ ...current, [key]: undefined }));
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const idempotencyKey = useMemo(() => Math.random().toString(36).slice(2, 12), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "");
    // Field problems are shown under the field; only the server's answer becomes a toast.
    const found = {
      name: field("name").trim() ? undefined : copy.errors.invalid_name,
      organization: field("organization").trim() ? undefined : copy.errors.invalid_organization,
      role: role ? undefined : copy.errors.invalid_role,
      email: /^\S+@\S+\.\S+$/.test(field("email").trim()) ? undefined : copy.errors.invalid_email,
      consent: consent ? undefined : copy.errors.consent_required
    };
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setPending(true);
    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({
          name: field("name"),
          organization: field("organization"),
          role,
          email: field("email"),
          phone: field("phone"),
          message: field("message"),
          website: field("website"),
          consent
        })
      });
      if (response.ok) {
        toast.success(copy.doneTitle, { description: copy.doneBody });
        setDone(true);
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      const errors = copy.errors as Record<string, string>;
      toast.error((payload.error && errors[payload.error]) || copy.errors.generic);
    } catch {
      toast.error(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-primary bg-muted px-4 py-4" role="status">
        <p className="font-semibold">{copy.doneTitle}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{copy.doneBody}</p>
        <Link className="mt-3 inline-block text-sm font-semibold text-primary hover:underline" href="/login">
          {copy.backToLogin}
        </Link>
      </div>
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void submit(event)}>
      <FormField label={copy.nameLabel} error={errors.name} autoComplete="name" required maxLength={200} name="name" onChange={() => clear("name")} />
      <FormField label={copy.organizationLabel} error={errors.organization} autoComplete="organization" required maxLength={200} name="organization" onChange={() => clear("organization")} />
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{copy.roleLabel}</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["corporate", copy.roleCorporate, Building2],
              ["ngo", copy.roleNgo, Heart]
            ] as const
          ).map(([value, label, Icon]) => (
            <label className="relative cursor-pointer" key={value}>
              <input
                checked={role === value}
                className="peer sr-only"
                name="role"
                onChange={() => {
                  setRole(value);
                  clear("role");
                }}
                type="radio"
                value={value}
              />
              <span className={`flex items-center gap-3 rounded-lg border ${errors.role ? "border-destructive/50" : ""} bg-card p-3.5 text-sm font-medium text-foreground transition-colors peer-checked:border-primary peer-checked:bg-accent peer-checked:[&>span]:bg-primary peer-checked:[&>span]:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50`}>
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"
                >
                  <Icon size={18} strokeWidth={2} />
                </span>
                {label}
              </span>
            </label>
          ))}
        </div>
        {errors.role ? (
          <p className="px-1 text-xs leading-4 text-destructive" role="alert">
            {errors.role}
          </p>
        ) : null}
      </fieldset>
      <FormField label={copy.emailLabel} error={errors.email} autoComplete="email" required maxLength={254} name="email" onChange={() => clear("email")} type="email" />
      <FormField label={copy.phoneLabel} autoComplete="tel" maxLength={50} name="phone" type="tel" />
      <FormTextarea label={copy.messageLabel} rows={2} maxLength={2000} name="message" />
      {/* Honeypot: hidden from people and assistive tech, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input autoComplete="off" name="website" tabIndex={-1} type="text" />
        </label>
      </div>
      <CheckField
        checked={consent}
        onChange={(next) => {
          setConsent(next);
          clear("consent");
        }}
      >
        {copy.consentBefore}{" "}
        <Link className="font-semibold text-primary hover:underline" href="/privacy" target="_blank">
          {copy.consentLink}
        </Link>{" "}
        {copy.consentAfter}
      </CheckField>
      {errors.consent ? (
        <p className="-mt-2 px-1 text-xs leading-4 text-destructive" role="alert">
          {errors.consent}
        </p>
      ) : null}
      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? copy.sending : copy.submit}
      </Button>
    </form>
  );
}

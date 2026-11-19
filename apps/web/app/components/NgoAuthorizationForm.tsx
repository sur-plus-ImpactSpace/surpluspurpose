"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

export type NgoAuthorizationValues = {
  registryNumber: string;
  taxAuthorizationRef: string;
  taxAuthorizationDate: string;
  taxOffice: string;
  authorizedSigner: string;
  authorizedSignerRole: string;
};

/**
 * A1: the NGO maintains the authorisation data (Vereinsregister no.,
 * Freistellungsbescheid + date, Finanzamt, authorised signer) that makes a
 * donation receipt legally complete. Saved via update_ngo_authorization; the
 * values are stamped onto the certificate Muster at render time. Needs a real
 * session; preview/demo renders a hint.
 */
export function NgoAuthorizationForm({
  config,
  initial
}: {
  config: SupabaseBrowserConfig | null;
  initial: NgoAuthorizationValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<NgoAuthorizationValues>(initial);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const set =
    (key: keyof NgoAuthorizationValues) => (event: ChangeEvent<HTMLInputElement>) =>
      setValues((current) => ({ ...current, [key]: event.target.value }));

  if (!config) {
    return (
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Enter your authorisation data once you sign in to your workspace.
      </p>
    );
  }
  const activeConfig = config;

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const supabase = getBrowserSupabaseClient(activeConfig);
      const { error } = await supabase.rpc("update_ngo_authorization", {
        p_tax_authorization_ref: values.taxAuthorizationRef,
        p_tax_authorization_date: values.taxAuthorizationDate || null,
        p_tax_office: values.taxOffice,
        p_registry_number: values.registryNumber,
        p_authorized_signer: values.authorizedSigner,
        p_authorized_signer_role: values.authorizedSignerRole
      });
      if (error) {
        setStatus(`Could not save: ${error.message}`);
        return;
      }
      setStatus("Saved.");
      router.refresh();
    } catch {
      setStatus("Could not save: network_error");
    } finally {
      setPending(false);
    }
  }

  const field =
    "h-10 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm";
  const label = "grid gap-1 text-xs font-medium text-muted-foreground";

  return (
    <form className="mt-4 grid gap-3" onSubmit={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Registry number
          <input className={field} onChange={set("registryNumber")} placeholder="VR 12345" value={values.registryNumber} />
        </label>
        <label className={label}>
          Tax office (Finanzamt)
          <input className={field} onChange={set("taxOffice")} placeholder="Finanzamt München" value={values.taxOffice} />
        </label>
        <label className={label}>
          Tax-exemption ref (Freistellungsbescheid)
          <input className={field} onChange={set("taxAuthorizationRef")} placeholder="143/456/78901" value={values.taxAuthorizationRef} />
        </label>
        <label className={label}>
          Tax-exemption date
          <input className={field} onChange={set("taxAuthorizationDate")} type="date" value={values.taxAuthorizationDate} />
        </label>
        <label className={label}>
          Authorised signer
          <input className={field} onChange={set("authorizedSigner")} placeholder="Anna Becker" value={values.authorizedSigner} />
        </label>
        <label className={label}>
          Signer role
          <input className={field} onChange={set("authorizedSignerRole")} placeholder="Board member" value={values.authorizedSignerRole} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save authorisation data"}
        </Button>
        {status ? (
          <span className="text-xs text-muted-foreground" role="status">
            {status}
          </span>
        ) : null}
      </div>
    </form>
  );
}

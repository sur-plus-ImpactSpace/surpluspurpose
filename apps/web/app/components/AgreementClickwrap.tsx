"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import { getDictionary, type Locale } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

/**
 * Clickwrap acceptance for a versioned agreement (SaaS terms, NGO partner
 * agreement). Records acceptance via the accept_agreement RPC (0010) — a
 * checkbox + versioned terms + audit trail, which is legally sufficient for
 * form-free agreements (no DocuSign). On mount it checks whether the current
 * version was already accepted and shows an accepted state instead. Needs a
 * real session; the preview/demo shows the terms but disables acceptance.
 */
export function AgreementClickwrap({
  config,
  description,
  kind,
  locale,
  termsHref,
  title,
  version
}: {
  config: SupabaseBrowserConfig | null;
  description: string;
  kind: string;
  locale: Locale;
  termsHref: string;
  title: string;
  version: string;
}) {
  const t = getDictionary(locale).auth.agreement;
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [acceptedVersion, setAcceptedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    let active = true;
    void (async () => {
      try {
        const supabase = getBrowserSupabaseClient(config);
        const { data } = await supabase
          .from("agreement_acceptances")
          .select("version")
          .eq("kind", kind)
          .order("accepted_at", { ascending: false })
          .limit(1);
        if (active && data && data.length > 0) {
          setAcceptedVersion(String((data[0] as { version: string }).version));
        }
      } catch {
        // Ignore — fall back to showing the clickwrap.
      }
    })();
    return () => {
      active = false;
    };
  }, [config, kind]);

  const alreadyAccepted = acceptedVersion === version;

  async function accept() {
    if (!config || !checked) return;
    setPending(true);
    setStatus(null);
    try {
      const supabase = getBrowserSupabaseClient(config);
      const { error } = await supabase.rpc("accept_agreement", { p_kind: kind, p_version: version });
      if (error) {
        setStatus(`${t.errSave} ${error.message}`);
        return;
      }
      setAcceptedVersion(version);
      router.refresh();
    } catch {
      setStatus(`${t.errSave} network_error`);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <p
        className="text-xs font-medium"
      >
        {t.eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>

      {alreadyAccepted ? (
        <p className="mt-3 inline-flex items-center rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t.accepted} {version}.
          <a
            className="ml-1 underline-offset-2 hover:underline"
            href={termsHref}
            rel="noreferrer"
            target="_blank"
          >
            {t.reviewTerms}
          </a>
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          <label className="flex items-start gap-2 text-sm leading-6 text-foreground/80">
            <input
              checked={checked}
              className="mt-1 shrink-0"
              onChange={(event) => setChecked(event.target.checked)}
              type="checkbox"
            />
            <span>
              {t.iAgreePrefix}
              <a
                className="underline-offset-2 hover:underline"
                href={termsHref}
                rel="noreferrer"
                target="_blank"
              >
                {title}
              </a>
              {t.iAgreeSuffixPre}
              {version}
              {t.iAgreeSuffixPost}
            </span>
          </label>
          <div className="flex items-center gap-3">
            <Button disabled={pending || !checked || !config} onClick={() => void accept()} type="button">
              {pending ? t.saving : t.accept}
            </Button>
            {!config ? <span className="text-xs text-muted-foreground">{t.availableOnSignin}</span> : null}
            {status ? (
              <span className="text-xs text-muted-foreground" role="status">
                {status}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

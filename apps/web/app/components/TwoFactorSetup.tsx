"use client";

import { Button } from "@/components/ui/button";
import { OtpField } from "./OtpField";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import { getDictionary, type Locale } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

/**
 * 2FA enrollment (TOTP) via Supabase MFA — the optional second factor from the
 * Smart-Simplicity auth set. Enrolls a TOTP factor, shows the QR code + secret
 * for an authenticator app, then verifies a code to activate it. The login
 * challenge lives in SmartLoginPanel. Needs a signed-in session; preview shows a
 * hint.
 */
export function TwoFactorSetup({
  config,
  locale,
  refreshOnEnable = false
}: {
  config: SupabaseBrowserConfig | null;
  locale: Locale;
  /** Re-render the server page once the session is at aal2 (admin 2FA gate). */
  refreshOnEnable?: boolean;
}) {
  const router = useRouter();
  const t = getDictionary(locale).auth.twoFactorSetup;
  const [step, setStep] = useState<"idle" | "verify">("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!config) {
    return (
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        {t.notAvailable}
      </p>
    );
  }
  const client = getBrowserSupabaseClient(config);

  async function begin() {
    setPending(true);
    setMessage(null);
    const { data, error } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `sur.plus ${new Date().toISOString()}`
    });
    setPending(false);
    if (error || !data) {
      setMessage(`${t.errStart} ${error?.message ?? "unknown error"}`);
      return;
    }
    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep("verify");
  }

  async function confirm() {
    if (!factorId) return;
    setPending(true);
    setMessage(null);
    const challenge = await client.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setPending(false);
      setMessage(`${t.errFailed} ${challenge.error?.message ?? "unknown error"}`);
      return;
    }
    const { error } = await client.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim()
    });
    setPending(false);
    if (error) {
      setMessage(`${t.errInvalidCode} ${error.message}`);
      return;
    }
    setStep("idle");
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    setMessage(t.enabled);
    if (refreshOnEnable) router.refresh();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <p
        className="text-xs font-medium"
      >
        {t.eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-semibold">{t.heading}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t.lead}
      </p>

      {step === "idle" ? (
        <Button
 className="mt-4"
 disabled={pending}
 onClick={() => void begin()}
 type="button">
          {pending ? t.starting : t.enable}
        </Button>
      ) : (
        <div className="mt-4 grid gap-3">
          <p className="text-sm leading-6 text-muted-foreground">
            {t.scanLead}
          </p>
          {qr ? (
            // Solid white with a wide margin (the "quiet zone") so scanners can read it on a dark page.
            <img
              alt={t.qrAlt}
              className="h-52 w-52 rounded-lg p-5"
              src={qr}
              style={{ background: "#ffffff" }}
            />
          ) : null}
          {secret ? (
            <p className="text-xs text-muted-foreground">
              {t.manualKey} <span className="font-mono text-foreground/80">{secret}</span>
            </p>
          ) : null}
          <OtpField disabled={pending} onChange={setCode} value={code} />
          <div>
            <Button disabled={pending || code.trim().length < 6} onClick={() => void confirm()} type="button">
              {pending ? t.verifying : t.verifyEnable}
            </Button>
          </div>
        </div>
      )}

      {message ? (
        <p className="mt-3 text-xs leading-5 text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

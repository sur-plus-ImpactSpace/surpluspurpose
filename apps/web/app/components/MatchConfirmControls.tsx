"use client";

import { Button } from "@/components/ui/button";
import { hasRecentEmailReauth, type MatchState } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders, getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import { useAgreementAccepted } from "../lib/use-agreement-accepted";
import type { MatchNextAction } from "./match-actions";
import { TurnstileWidget } from "./TurnstileWidget";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TransitionResponse = { match?: { id: string; state: MatchState }; error?: string };

/** Optional clickwrap gate: this transition is blocked until the agreement is accepted. */
export type AgreementGate = { kind: string; version: string; label: string };

export function MatchConfirmControls({
  action,
  actorUserId,
  authConfig,
  matchId,
  requiresAgreement
}: {
  action: MatchNextAction;
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  matchId: string;
  requiresAgreement?: AgreementGate;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const idempotencyPrefix = useMemo(() => stableId(), []);
  const gate = useAgreementAccepted(authConfig, requiresAgreement?.kind ?? null, requiresAgreement?.version ?? "");
  const blocked = gate === "missing";
  // Confirming receipt issues the donation certificate, so it asks for a fresh
  // email proof first (ADR 0027 C5). The database enforces it; this only asks
  // early. A preview session has no email identity, hence the authConfig check.
  const needsStepUp = action.nextState === "completed" && authConfig !== null;
  const [stepUp, setStepUp] = useState<"idle" | "needed" | "sent">("idle");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function hasFreshEmailProof(): Promise<boolean> {
    if (!authConfig) return true;
    const { data } = await getBrowserSupabaseClient(authConfig).auth.getSession();
    const claims = accessTokenClaims(data.session?.access_token);

    return hasRecentEmailReauth(claims?.amr, Date.now() / 1000);
  }

  async function sendConfirmationLink() {
    if (!authConfig) return;
    setPending(true);
    setStatus(null);
    try {
      const client = getBrowserSupabaseClient(authConfig);
      const { data } = await client.auth.getUser();
      const email = data.user?.email;
      if (!email) {
        setStatus("Action failed: auth_required");
        return;
      }
      const redirect = new URL(window.location.href);
      redirect.hash = "";
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirect.toString(),
          ...(captchaToken ? { captchaToken } : {})
        }
      });
      if (error) {
        setStatus(`Could not send the link: ${error.message}`);
        return;
      }
      setStepUp("sent");
    } finally {
      setPending(false);
      setCaptchaToken(null);
    }
  }

  async function submit() {
    setPending(true);
    setStatus(null);
    try {
      if (needsStepUp && !(await hasFreshEmailProof())) {
        setStepUp("needed");
        return;
      }

      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setStatus("Action failed: auth_required");
        return;
      }

      const response = await fetch(`/api/matches/${encodeURIComponent(matchId)}/transition`, {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-transition-${Date.now()}`
        },
        body: JSON.stringify({ nextState: action.nextState })
      });
      const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as TransitionResponse;

      if (payload.error === "step_up_required") {
        setStepUp("needed");
        return;
      }
      if (!response.ok || payload.error || !payload.match) {
        setStatus(`Action failed: ${payload.error ?? response.status}`);
        return;
      }

      setStatus("Updated — refreshing the workspace…");
      router.refresh();
    } catch {
      setStatus("Action failed: network_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="rounded-lg border border-primary/30 bg-primary/5 p-5"
    >
      <p className="text-xs font-medium text-muted-foreground">Next step</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.hint}</p>
      <Button
 className="mt-3"
 disabled={pending || blocked}
 onClick={() => void submit()}
 type="button">
        {pending ? "Working…" : action.label}
      </Button>
      {stepUp !== "idle" ? (
        <div className="mt-3 rounded-md border border-border bg-card/70 p-3 text-sm leading-6 text-muted-foreground" role="status">
          {stepUp === "needed" ? (
            <>
              <p>
                This step issues your donation certificate, so we need to confirm it is really you. We will email you a
                one-time link — open it, then come back here and confirm receipt again.
              </p>
              {TURNSTILE_SITE_KEY ? (
                <div className="mt-2">
                  <TurnstileWidget onToken={setCaptchaToken} siteKey={TURNSTILE_SITE_KEY} />
                </div>
              ) : null}
              <Button variant="outline"
 className="mt-2"
 disabled={pending || (Boolean(TURNSTILE_SITE_KEY) && !captchaToken)}
 onClick={() => void sendConfirmationLink()}
 type="button">
                Email me the confirmation link
              </Button>
            </>
          ) : (
            <p>Check your inbox. Open the link within ten minutes, then confirm receipt again.</p>
          )}
        </div>
      ) : null}
      {blocked && requiresAgreement ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Accept the {requiresAgreement.label} below before you can continue.
        </p>
      ) : null}
      {status ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </section>
  );
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

function accessTokenClaims(token: string | undefined): { amr?: unknown } | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as { amr?: unknown };
  } catch {
    return null;
  }
}

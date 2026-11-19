"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { Dictionary } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type InvitationAcceptancePanelProps = {
  config: SupabaseBrowserConfig | null;
  t: Dictionary["auth"]["invitation"];
  token: string | null;
};

export function InvitationAcceptancePanel({ config, t, token }: InvitationAcceptancePanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function acceptInvitation() {
    if (!config) {
      setMessage(t.notConfigured);
      return;
    }
    if (!token) {
      setMessage(t.openLink);
      return;
    }

    setPending(true);
    setMessage(null);
    const headers = await browserRouteHeaders({
      config,
      contentTypeJson: true,
      previewUserId: "usr-corporate-acme"
    });
    if (!headers.authorization) {
      setPending(false);
      setMessage(t.signInFirst);
      return;
    }

    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers,
      body: JSON.stringify({ token })
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);

    if (!response.ok) {
      setMessage(payload?.error ? `${t.activationFailed} ${payload.error}` : t.activationFailedGeneric);
      return;
    }

    setMessage(t.activated);
    window.location.replace("/");
  }

  return (
    <section className="rounded-lg border border-primary bg-muted p-5">
      <p className="text-xs font-medium text-primary">{t.eyebrow}</p>
      <h2 className="mt-3 text-xl font-semibold">{token ? t.activateTitle : t.linkRequiredTitle}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {token ? t.activateLead : t.linkRequiredLead}
      </p>
      <Button
 className="mt-5"
 disabled={pending || !token}
 onClick={() => void acceptInvitation()}
 type="button">
        {pending ? t.activating : t.activate}
      </Button>
      {message ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

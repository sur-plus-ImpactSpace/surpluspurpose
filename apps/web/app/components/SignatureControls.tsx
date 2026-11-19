"use client";

import { Button } from "@/components/ui/button";
import type { SignatureEnvelope } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

const STATE_LABEL: Record<SignatureEnvelope["state"], string> = {
  draft: "Signature draft",
  sent: "Awaiting signatures",
  partially_signed: "Partly signed",
  completed: "Signed by both sides",
  declined: "Signature declined",
  voided: "Signature request cancelled"
};

const ERRORS: Record<string, string> = {
  esign_not_configured: "E-signature is not set up yet.",
  esign_unavailable: "The signing service could not be reached. Please try again.",
  signer_email_missing: "Both organisations need a contact email first.",
  document_not_ready: "The certificate is not ready for signing yet.",
  envelope_exists: "This document is already out for signature."
};

/**
 * Where a donation certificate stands in e-signature, and (for Ops) the button
 * that sends it out. Status text comes from DocuSeal's webhook only; nothing
 * here can mark a document signed.
 */
export function SignatureControls({
  actorUserId,
  authConfig,
  canSend,
  documentId,
  envelope
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  canSend: boolean;
  documentId: string;
  envelope: SignatureEnvelope | undefined;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const key = useMemo(() => Math.random().toString(36).slice(2, 10), []);
  const live = envelope && envelope.state !== "declined" && envelope.state !== "voided";

  async function send() {
    setPending(true);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({ config: authConfig, contentTypeJson: true, previewUserId: actorUserId });
      if (authConfig && !headers.authorization) {
        setStatus("Please sign in again.");
        return;
      }
      const response = await fetch("/api/signature-envelopes", {
        method: "POST",
        headers: { ...headers, "idempotency-key": `${key}-sign-${documentId}` },
        body: JSON.stringify({ documentId })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(ERRORS[payload.error ?? ""] ?? "We could not send it for signature. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setStatus("We could not send it for signature. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 text-xs text-muted-foreground">
      {envelope ? (
        <p>
          <span className="font-semibold">{STATE_LABEL[envelope.state]}</span>
          {envelope.recipients.length > 0
            ? ` · ${envelope.recipients.map((item) => `${item.partyName}: ${item.status}`).join(" · ")}`
            : ""}
          {envelope.state === "completed" && envelope.signedStoragePath ? (
            <>
              {" · "}
              <a className="font-semibold text-primary hover:underline" href={`/api/signature-envelopes/${encodeURIComponent(envelope.id)}/signed`} rel="noreferrer" target="_blank">
                Signed copy
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {canSend && !live ? (
        <Button variant="outline"
 className="mt-1"
 disabled={pending}
 onClick={() => void send()}
 type="button">
          {pending ? "Sending…" : envelope ? "Send again for e-signature" : "Send for e-signature"}
        </Button>
      ) : null}
      {status ? <p className="mt-1 text-muted-foreground">{status}</p> : null}
    </div>
  );
}

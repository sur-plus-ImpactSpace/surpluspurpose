"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import { NGO_PARTNER_AGREEMENT } from "../lib/agreements";
import { useAgreementAccepted } from "../lib/use-agreement-accepted";

/**
 * Gegenzeichnung (0008): the NGO counter-signs a donation-certificate Muster
 * (status `in_review`) for a match it owns via confirm_donation_certificate,
 * which publishes it and releases it to the corporate for download. Needs a
 * real session; the preview/demo renders a static "awaiting" badge.
 */
// Known reasons raised by confirm_donation_certificate (0008/0028), surfaced
// cleanly instead of the raw Postgres error. `evidence_required` is the
// Wert-Beleg-Tor (ADR 0029): countersign needs at least one evidence upload.
const CERTIFICATE_CONFIRM_REASONS = [
  "auth_required",
  "document_not_found",
  "not_a_certificate",
  "invalid_status",
  "actor_not_allowed",
  "evidence_required"
] as const;

function certificateConfirmReason(message: string): string {
  return CERTIFICATE_CONFIRM_REASONS.find((reason) => message.includes(reason)) ?? message;
}

export function CertificateConfirmControls({
  config,
  documentId
}: {
  config: SupabaseBrowserConfig | null;
  documentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const gate = useAgreementAccepted(config, NGO_PARTNER_AGREEMENT.kind, NGO_PARTNER_AGREEMENT.version);
  const blocked = gate === "missing";

  if (!config) {
    return (
      <span className="rounded-sm bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Awaiting confirmation
      </span>
    );
  }
  const activeConfig = config;

  async function confirm() {
    setPending(true);
    setStatus(null);
    try {
      const supabase = getBrowserSupabaseClient(activeConfig);
      const { error } = await supabase.rpc("confirm_donation_certificate", {
        p_document_id: documentId
      });
      if (error) {
        setStatus(`Could not confirm: ${certificateConfirmReason(error.message)}`);
        return;
      }
      router.refresh();
    } catch {
      setStatus("Could not confirm: network_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid justify-items-end gap-1">
      <Button size="sm" disabled={pending || blocked} onClick={() => void confirm()} type="button">
        {pending ? "Confirming…" : "Counter-sign"}
      </Button>
      {blocked ? (
        <span className="text-[11px] text-muted-foreground">
          Accept the Partner Agreement to counter-sign.
        </span>
      ) : null}
      {status ? (
        <span className="text-[11px] text-muted-foreground" role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}

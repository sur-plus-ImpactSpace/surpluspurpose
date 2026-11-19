"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "./browser-supabase";
import type { SupabaseBrowserConfig } from "./service-chat-realtime";

export type AgreementGateStatus = "ok" | "loading" | "missing";

/**
 * Client mirror of the server clickwrap gate (migration 0012): has the caller
 * accepted `version` of `kind`? This only drives UX — it disables a gated
 * action and points the user at the agreement to accept. The RPC re-checks and
 * raises `agreement_required` regardless, so this is not a security boundary.
 *
 * No-op ("ok") when there is no auth backend (preview/demo), no `kind`, or the
 * lookup fails — never hard-block on a client read that the server still gates.
 */
export function useAgreementAccepted(
  config: SupabaseBrowserConfig | null,
  kind: string | null,
  version: string
): AgreementGateStatus {
  const [status, setStatus] = useState<AgreementGateStatus>(config && kind ? "loading" : "ok");

  useEffect(() => {
    if (!config || !kind) {
      setStatus("ok");
      return;
    }
    let active = true;
    setStatus("loading");
    void (async () => {
      try {
        const supabase = getBrowserSupabaseClient(config);
        const { data } = await supabase
          .from("agreement_acceptances")
          .select("version")
          .eq("kind", kind)
          .eq("version", version)
          .limit(1);
        if (!active) return;
        setStatus(data && data.length > 0 ? "ok" : "missing");
      } catch {
        if (active) setStatus("ok");
      }
    })();
    return () => {
      active = false;
    };
  }, [config, kind, version]);

  return status;
}

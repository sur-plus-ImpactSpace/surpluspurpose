"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

/** Copy for the post-registration confirmation, from the shared auth dictionary. */
export type RegisteredCopy = {
  eyebrow: string;
  titleConfirmed: string;
  leadConfirmed: string;
  titlePending: string;
  leadPending: string;
  continueCta: string;
  toSignin: string;
  checking: string;
};

type Status = "checking" | "confirmed" | "pending";

/**
 * Post-registration confirmation. Serves both entry points:
 * - straight after the sign-up form (local / no e-mail confirmation → a session
 *   already exists → "you're registered, continue"), and
 * - after clicking the confirmation link in the e-mail (session established from
 *   the URL → same "continue" path).
 * When no session turns up (production, e-mail confirmation still pending) it
 * falls back to a "confirm your e-mail, then sign in" message.
 */
export function RegisteredPanel({
  config,
  copy
}: {
  config: SupabaseBrowserConfig;
  copy: RegisteredCopy;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const client = getBrowserSupabaseClient(config);
    let settled = false;
    const decide = (hasSession: boolean) => {
      settled = true;
      setStatus(hasSession ? "confirmed" : "pending");
    };
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (session) decide(true);
    });
    void client.auth.getSession().then(({ data }) => {
      if (data.session) decide(true);
    });
    // No session shortly after landing → e-mail confirmation is still pending.
    const timer = setTimeout(() => {
      if (!settled) setStatus("pending");
    }, 2000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [config]);

  if (status === "checking") {
    return (
      <p className="text-sm leading-6 text-muted-foreground" role="status">
        {copy.checking}
      </p>
    );
  }

  const confirmed = status === "confirmed";

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-[11px] font-medium text-primary">
          {copy.eyebrow}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span aria-hidden className="text-2xl">✓</span>
          <h2 className="text-2xl font-semibold text-foreground">
            {confirmed ? copy.titleConfirmed : copy.titlePending}
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {confirmed ? copy.leadConfirmed : copy.leadPending}
        </p>
      </div>

      {confirmed ? (
        <Button
          
          onClick={() => {
            router.replace("/");
            router.refresh();
          }}
          type="button"
        >
          {copy.continueCta}
        </Button>
      ) : (
        <a
          className="rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
          href="/login"
        >
          {copy.toSignin}
        </a>
      )}
    </div>
  );
}

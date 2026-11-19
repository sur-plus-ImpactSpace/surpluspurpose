"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { Dictionary } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import type { WorkspaceDataSource } from "../lib/workspace-data";

type AuthSessionControlsProps = {
  config: SupabaseBrowserConfig | null;
  source: WorkspaceDataSource;
  t: Dictionary["auth"]["session"];
};

export function AuthSessionControls({ config, source, t }: AuthSessionControlsProps) {
  const router = useRouter();
  const supabase = useMemo(() => (config ? getBrowserSupabaseClient(config) : null), [config]);
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const sessionUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }

    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      sessionUserRef.current = data.session?.user.id ?? null;
      setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) return;
      setSession(nextSession);
      // After a magic-link return (or sign-out) the server rendered this page
      // without the new auth cookie. Refresh once so server redirects and
      // workspace data pick up the session — e.g. /login forwards to /.
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== sessionUserRef.current) {
        sessionUserRef.current = nextUserId;
        router.refresh();
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [supabase, router]);

  async function sendMagicLink() {
    if (!supabase) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setMessage(t.enterEmail);
      return;
    }

    setPending(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: currentUrlWithoutHash()
      }
    });
    setPending(false);
    setMessage(error ? `${t.signInFailed} ${error.message}` : t.magicLinkSent);
  }

  async function signOut() {
    if (!supabase) return;
    setPending(true);
    const { error } = await supabase.auth.signOut();
    setPending(false);
    setMessage(error ? `${t.signOutFailed} ${error.message}` : t.signedOut);
  }

  if (!config) {
    return (
      <section className="rounded-lg border border-border bg-muted p-3">
        <p className="text-xs font-medium text-muted-foreground">{t.eyebrow}</p>
        <p className="mt-1 text-sm font-semibold">{t.previewAccess}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t.notConfigured}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-muted p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t.eyebrow}</p>
          <p className="mt-1 text-sm font-semibold">{session ? t.signedIn : t.signIn}</p>
        </div>
        {source === "preview" ? (
          <span className="rounded-sm bg-card px-2 py-0.5 text-xs font-semibold text-muted-foreground">{t.demo}</span>
        ) : null}
      </div>

      {session ? (
        <div className="mt-3 grid gap-2">
          <p className="truncate text-xs text-muted-foreground">{session.user.email ?? session.user.id}</p>
          <Button variant="outline" disabled={pending} onClick={() => void signOut()} type="button">
            {t.signOut}
          </Button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          <Input
            
            disabled={pending}
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t.emailPlaceholder}
            type="email"
            value={email}
          />
          <Button disabled={pending} onClick={() => void sendMagicLink()} type="button">
            {pending ? t.sending : t.sendLink}
          </Button>
        </div>
      )}
      {message ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}

function currentUrlWithoutHash(): string {
  const url = new URL(window.location.href);
  url.hash = "";

  return url.toString();
}

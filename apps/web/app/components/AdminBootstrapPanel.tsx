"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import { RevealButton } from "./SmartLoginPanel";

type AdminBootstrapPanelProps = {
  authConfig: SupabaseBrowserConfig | null;
};

type BootstrapResponse =
  | {
      runtime: "service-role-bootstrap";
      state: "already_admin" | "created";
      user: {
        email: string;
        role: "admin";
      };
    }
  | {
      error: string;
    };

export function AdminBootstrapPanel({ authConfig }: AdminBootstrapPanelProps) {
  const supabase = useMemo(() => (authConfig ? getBrowserSupabaseClient(authConfig) : null), [authConfig]);
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  async function submitBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase Auth is not configured.");
      return;
    }
    if (!bootstrapToken.trim()) {
      setMessage("Enter the bootstrap token.");
      return;
    }

    setPending(true);
    setMessage(null);
    setReady(false);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setMessage("Sign in before bootstrapping Ops access.");
        return;
      }

      const response = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "x-surplus-bootstrap-token": bootstrapToken.trim()
        },
        body: JSON.stringify({
          fullName: fullName.trim() || undefined
        })
      });
      const body = (await response.json().catch(() => ({ error: "invalid_response" }))) as BootstrapResponse;
      if (!response.ok || "error" in body) {
        setMessage(`Bootstrap failed: ${"error" in body ? body.error : response.status}`);
        return;
      }

      setBootstrapToken("");
      setReady(true);
      setMessage(body.state === "already_admin" ? "Ops access already active." : "Ops access created.");
      // Straight into the admin workspace: no extra click.
      window.location.assign("/ops");
    } catch {
      setMessage("Bootstrap failed: network_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5 shadow-xs">
      <p className="text-xs font-medium text-muted-foreground">Ops bootstrap</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-normal">Activate admin access</h2>

      <form className="mt-6 grid gap-4" onSubmit={(event) => void submitBootstrap(event)}>
        <label className="grid gap-2 text-sm font-semibold text-muted-foreground">
          Full name
          <Input
            autoComplete="name"
            
            disabled={pending}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Florian Lechner"
            type="text"
            value={fullName}
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-muted-foreground">
          Bootstrap token
          <div className="relative">
            <Input
              autoComplete="one-time-code"
              className="w-full pr-11"
              disabled={pending}
              onChange={(event) => setBootstrapToken(event.target.value)}
              placeholder="Configured server secret"
              type={showToken ? "text" : "password"}
              value={bootstrapToken}
            />
            <RevealButton
              hide="Hide token"
              onToggle={() => setShowToken((v) => !v)}
              show="Show token"
              shown={showToken}
            />
          </div>
        </label>

        <Button size="lg" disabled={pending} type="submit">
          {pending ? "Activating..." : "Activate Ops access"}
        </Button>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm leading-5 text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {ready ? (
        <a className="mt-3 inline-flex rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href="/ops">
          Open Ops
        </a>
      ) : null}
    </section>
  );
}

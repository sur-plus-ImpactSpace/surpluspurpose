"use client";

import { useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

/** "Signed in as … · Sign out": the quiet footer of pages that have nothing else to say about the session. */
export function SignedInLine({ config, email }: { config: SupabaseBrowserConfig; email: string | null }) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await getBrowserSupabaseClient(config).auth.signOut();
    window.location.assign("/login");
  }

  return (
    <p className="text-sm text-muted-foreground">
      Signed in as <span className="font-medium text-foreground">{email ?? "your account"}</span> ·{" "}
      <button
        className="text-foreground underline-offset-2 hover:underline disabled:opacity-50"
        disabled={pending}
        onClick={() => void signOut()}
        type="button"
      >
        Sign out
      </button>
    </p>
  );
}

"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "./FormField";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import { passwordMeetsPolicy } from "./SmartLoginPanel";

/** Where an invited admin lands from the email link: choose a password, then into /ops. */
export function SetPasswordForm({ config }: { config: SupabaseBrowserConfig }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(config), [config]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // The invite link signs the browser in; give the client a moment to read it.
    const check = () => supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    void check();
    const { data } = supabase.auth.onAuthStateChange(() => void check());

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    if (!passwordMeetsPolicy(password)) {
      setError("Use at least 8 characters with upper and lower case, a number and a symbol.");
      return;
    }
    setError(undefined);
    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setPending(false);
      toast.error("Could not set the password. Open the invitation link again.");
      return;
    }
    window.location.assign("/ops");
  }

  if (signedIn === false) {
    return <p className="text-sm text-muted-foreground">This invitation link is invalid or has expired. Ask the super admin for a new one.</p>;
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void submit(event)}>
      <FormField label="Choose a password" error={error} autoComplete="new-password" name="password" onChange={() => setError(undefined)} type="password" />
      <Button className="w-full" disabled={pending || signedIn === null} size="lg" type="submit">
        {pending ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}

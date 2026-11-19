"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "./FormField";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { OtpField } from "./OtpField";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

/**
 * Admin sign-in: email and password, then the 6-digit code (admins must use two-factor).
 * There is no sign-up here; admin accounts are seeded (super admin) or invited by the
 * super admin. `needsCode` opens straight on the code step for a session that has
 * passed the password but not yet the code.
 */
export function AdminLoginForm({ config, needsCode = false }: { config: SupabaseBrowserConfig; needsCode?: boolean }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(config), [config]);
  const [errors, setErrors] = useState<{ code?: string; email?: string; password?: string }>({});
  const [factorId, setFactorId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState("");

  async function loadFactor(): Promise<boolean> {
    const factors = await supabase.auth.mfa.listFactors();
    const totp = factors.data?.totp.find((factor) => factor.status === "verified");
    if (!totp) return false;
    setFactorId(totp.id);

    return true;
  }

  useEffect(() => {
    if (needsCode) void loadFactor();
  }, [needsCode]);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const found = {
      email: email ? undefined : "Enter your email.",
      password: password ? undefined : "Enter your password."
    };
    setErrors(found);
    if (found.email || found.password) return;

    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setPending(false);
      toast.error("Wrong email or password.");
      return;
    }
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.data?.currentLevel === "aal1" && aal.data?.nextLevel === "aal2" && (await loadFactor())) {
      setPending(false);
      return;
    }
    // A full navigation so the server renders /ops with the new session cookie.
    window.location.assign("/ops");
  }

  async function forgotPassword(form: HTMLFormElement | null) {
    const email = String(new FormData(form ?? undefined).get("email") ?? "").trim().toLowerCase();
    if (!email) {
      setErrors({ email: "Enter your email first, then ask for the reset link." });
      return;
    }
    setErrors({});
    setPending(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/ops/set-password` });
    setPending(false);
    // The same message whether or not the address is an admin: it never reveals who has an account.
    toast.success("If that email belongs to an admin, a reset link is on its way.");
  }

  async function submitCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (code.length < 6 || !factorId) {
      setErrors({ code: "Enter the 6-digit code." });
      return;
    }
    setErrors({});
    setPending(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setPending(false);
      toast.error("Could not check the code. Try again.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code });
    if (error) {
      setPending(false);
      setCode("");
      setErrors({ code: "That code is not right." });
      return;
    }
    window.location.assign("/ops");
  }

  async function signOut() {
    setPending(true);
    await supabase.auth.signOut();
    // Back to a clean password step (a full load also clears the half-signed-in session).
    window.location.assign("/ops/login");
  }

  if (factorId) {
    return (
      <form className="grid gap-4" noValidate onSubmit={(event) => void submitCode(event)}>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Authenticator code</span>
          <OtpField
            disabled={pending}
            invalid={Boolean(errors.code)}
            onChange={(next) => {
              setCode(next);
              setErrors({});
            }}
            onComplete={() => void submitCode()}
            value={code}
          />
          {errors.code ? (
            <p className="text-xs leading-4 text-destructive" role="alert">
              {errors.code}
            </p>
          ) : null}
        </div>
        <Button className="w-full" disabled={pending} size="lg" type="submit">
          {pending ? "Checking…" : "Verify"}
        </Button>
        <div className="flex justify-end">
          <button
            className="text-sm text-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending}
            onClick={() => void signOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void submitPassword(event)}>
      <FormField label="Email" error={errors.email} placeholder="name@company.com" autoComplete="username" name="email" onChange={() => setErrors((current) => ({ ...current, email: undefined }))} type="email" />
      <FormField label="Password" error={errors.password} autoComplete="current-password" name="password" onChange={() => setErrors((current) => ({ ...current, password: undefined }))} type="password" />
      <div className="-mt-2 flex justify-end">
        <button
          className="text-sm text-foreground underline-offset-2 hover:underline disabled:opacity-50"
          disabled={pending}
          onClick={(event) => void forgotPassword(event.currentTarget.form)}
          type="button"
        >
          Forgot password?
        </button>
      </div>
      <Button className="w-full" disabled={pending} size="lg" type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage, type AuthErrorCopy } from "../lib/auth-error-message";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import {
  PasswordChecklist,
  RevealButton,
  passwordMeetsPolicy,
  type PanelCopy,
  type PasswordCopy
} from "./SmartLoginPanel";

/** Only the panel strings the reset page needs — reuses the shared auth dictionary. */
export type ResetPanelCopy = Pick<
  PanelCopy,
  | "recoveryTitle"
  | "recoveryLead"
  | "recoveryChecking"
  | "recoveryInvalid"
  | "recoveryBackToLogin"
  | "newPasswordPlaceholder"
  | "confirmPasswordPlaceholder"
  | "passwordsDontMatch"
  | "recoverySaving"
  | "recoverySet"
  | "passwordUpdated"
  | "setPasswordFailed"
  | "showPassword"
  | "hidePassword"
> &
  AuthErrorCopy;

type Status = "checking" | "ready" | "invalid" | "done";

/**
 * The dedicated password-reset surface. The email link redirects here (not to
 * /login, which would bounce a recovered session into the workspace). Supabase
 * establishes a short-lived recovery session from the URL on load; this panel
 * waits for it, then lets the user set a new password via `updateUser`.
 */
export function ResetPasswordPanel({
  config,
  panel,
  password
}: {
  config: SupabaseBrowserConfig;
  panel: ResetPanelCopy;
  password: PasswordCopy;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const client = getBrowserSupabaseClient(config);
    let settled = false;
    const markReady = () => {
      settled = true;
      setStatus((current) => (current === "done" ? current : "ready"));
    };
    // Implicit hash flow emits PASSWORD_RECOVERY; PKCE code exchange emits
    // SIGNED_IN. Either way, a session on this page means the reset link was
    // valid and the user may set a new password.
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) markReady();
    });
    // The client may have processed the URL before the listener attached.
    void client.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });
    // No session shortly after landing → link missing, already used, or expired.
    const timer = setTimeout(() => {
      if (!settled) setStatus("invalid");
    }, 2500);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [config]);

  async function submit() {
    if (!passwordMeetsPolicy(newPassword)) {
      setMessage(password.incomplete);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage(panel.passwordsDontMatch);
      return;
    }
    setPending(true);
    setMessage(null);
    const client = getBrowserSupabaseClient(config);
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) {
      setPending(false);
      setMessage(authErrorMessage(error, panel));
      return;
    }
    // A password reset should invalidate every other session (a compromised
    // password may have live sessions elsewhere). Keeps this recovery session;
    // best-effort so it never blocks the success path.
    await client.auth.signOut({ scope: "others" }).catch(() => undefined);
    setStatus("done");
    setMessage(panel.passwordUpdated);
    router.replace("/");
    router.refresh();
  }

  const field =
    "h-10 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm pr-11";

  if (status === "checking") {
    return (
      <p className="text-sm leading-6 text-muted-foreground" role="status">
        {panel.recoveryChecking}
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <div className="grid gap-3">
        <p className="text-sm leading-6 text-muted-foreground">{panel.recoveryInvalid}</p>
        <a
          className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
          href="/login"
        >
          {panel.recoveryBackToLogin}
        </a>
      </div>
    );
  }

  const busy = pending || status === "done";
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSubmit = passwordMeetsPolicy(newPassword) && newPassword === confirmPassword;

  return (
    <div className="grid gap-3">
      <p className="text-lg font-semibold text-foreground">{panel.recoveryTitle}</p>
      <p className="text-sm leading-6 text-muted-foreground">{panel.recoveryLead}</p>
      <div className="relative">
        <input
          autoComplete="new-password"
          className={field}
          disabled={busy}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder={panel.newPasswordPlaceholder}
          type={showPassword ? "text" : "password"}
          value={newPassword}
        />
        <RevealButton
          hide={panel.hidePassword}
          onToggle={() => setShowPassword((v) => !v)}
          show={panel.showPassword}
          shown={showPassword}
        />
      </div>
      <PasswordChecklist copy={password} value={newPassword} />
      <div className="relative">
        <input
          autoComplete="new-password"
          className={field}
          disabled={busy}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder={panel.confirmPasswordPlaceholder}
          type={showConfirm ? "text" : "password"}
          value={confirmPassword}
        />
        <RevealButton
          hide={panel.hidePassword}
          onToggle={() => setShowConfirm((v) => !v)}
          show={panel.showPassword}
          shown={showConfirm}
        />
      </div>
      {mismatch ? (
        <p className="text-xs leading-5 text-muted-foreground">{panel.passwordsDontMatch}</p>
      ) : null}
      <Button
        disabled={busy || !canSubmit}
        onClick={() => void submit()}
        type="button"
      >
        {busy ? panel.recoverySaving : panel.recoverySet}
      </Button>
      {message ? (
        <p className="text-xs leading-5 text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

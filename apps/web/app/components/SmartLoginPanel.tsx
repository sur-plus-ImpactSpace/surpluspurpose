"use client";

import { isFreemailEmail } from "@surplus/domain";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { NGO_PARTNER_AGREEMENT, PRIVACY_POLICY, SAAS_TERMS } from "../lib/agreements";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckField } from "./CheckField";
import { OtpField } from "./OtpField";
import { ArrowRight, Building2, Check, Circle, Heart } from "lucide-react";
import { authErrorMessage } from "../lib/auth-error-message";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import { TurnstileWidget } from "./TurnstileWidget";

/**
 * Public Cloudflare Turnstile site key — enables the bot check when configured.
 *
 * Turnstile is ALL-OR-NOTHING and must be kept in sync across two places:
 *   - server: Supabase `[auth.captcha] enabled` (config.toml locally, project
 *     dashboard in staging/prod)
 *   - client: this `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
 * If the server has captcha ON but this key is unset, no widget renders and
 * every auth call is rejected with a cryptic "captcha required" the user can't
 * act on. See docs/ops/auth-email-delivery-runbook.md.
 */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type Pending = null | "google" | "password" | "link" | "reset" | "recover" | "resend";

type FieldKey = "email" | "password" | "orgName" | "orgType" | "salutation" | "firstName" | "lastName" | "consent";

type RequestedRole = "ngo" | "corporate";

export type RegisterCopy = {
  orgNameMissing: string;
  salutationLabel: string;
  salutationPlaceholder: string;
  salutationHerr: string;
  salutationFrau: string;
  salutationDivers: string;
  salutationMissing: string;
  academicTitleLabel: string;
  academicTitleNone: string;
  firstNamePlaceholder: string;
  lastNamePlaceholder: string;
  firstNameMissing: string;
  lastNameMissing: string;
  orgTypeLabel: string;
  orgTypePlaceholder: string;
  orgTypeVerein: string;
  orgTypeGgmbh: string;
  orgTypeStiftung: string;
  orgTypePublicBody: string;
  orgTypeFreierTraeger: string;
  orgTypeMissing: string;
  corporateFreemail: string;
  rolePlaceholder: string;
  phonePlaceholder: string;
  confirmEyebrow: string;
  confirmTitle: string;
  confirmBodyBefore: string;
  confirmBodyAfter: string;
  confirmHint: string;
  confirmBack: string;
  orgNamePlaceholderNgo: string;
  orgNamePlaceholderCorporate: string;
  chooseTitle: string;
  chooseLead: string;
  ngo: string;
  ngoHint: string;
  corporate: string;
  corporateHint: string;
  change: string;
  continueNgo: string;
  continueCorporate: string;
  consentLead: string;
  consentBefore: string;
  consentPrivacyLink: string;
  consentTermsCorporate: string;
  consentTermsNgo: string;
  consentRequired: string;
};

/**
 * Localized copy for the live password checklist. The rule *ids* and their
 * tests live in code (below); only the human-readable labels are translated,
 * so English and German stay in lockstep with the same policy.
 */
export type PasswordCopy = {
  heading: string;
  aria: string;
  length: string;
  upper: string;
  lower: string;
  digit: string;
  symbol: string;
  incomplete: string;
};

/** All remaining sign-in panel copy — buttons, placeholders, status/error lines. */
export type PanelCopy = {
  unavailable: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  newPasswordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  signIn: string;
  createAccount: string;
  working: string;
  sending: string;
  magicLink: string;
  forgotPassword: string;
  toSignup: string;
  toSignin: string;
  googleRedirecting: string;
  googleContinue: string;
  or: string;
  recoveryTitle: string;
  recoveryLead: string;
  recoverySaving: string;
  recoverySet: string;
  mfaTitle: string;
  mfaLead: string;
  mfaVerifying: string;
  mfaVerify: string;
  enterEmailPassword: string;
  enterPassword: string;
  enterEmail: string;
  enterEmailReset: string;
  magicLinkSent: string;
  resetSent: string;
  passwordUpdated: string;
  googleFailed: string;
  signUpFailed: string;
  signInFailed: string;
  mfaFailed: string;
  invalidCode: string;
  setPasswordFailed: string;
  resetFailed: string;
  recoveryChecking: string;
  recoveryInvalid: string;
  recoveryBackToLogin: string;
  confirmPasswordPlaceholder: string;
  passwordsDontMatch: string;
  captchaRequired: string;
  // Confirmation-email resend (shown when a sign-in hits an unconfirmed account).
  emailNotConfirmed: string;
  resendConfirmation: string;
  confirmationResent: string;
  // Localized auth errors — mapped from Supabase error codes so users never see
  // a raw half-English message. See lib/auth-error-message.ts.
  errInvalidCredentials: string;
  errRateLimited: string;
  errUserExists: string;
  errWeakPassword: string;
  errInvalidEmail: string;
  errSamePassword: string;
  errGeneric: string;
};

/** Small eye toggle to reveal/hide a password field while typing. */
export function RevealButton({ shown, onToggle, show, hide }: { shown: boolean; onToggle: () => void; show: string; hide: string }) {
  return (
    <button
      aria-label={shown ? hide : show}
      aria-pressed={shown}
      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-muted-foreground"
      onClick={onToggle}
      tabIndex={-1}
      title={shown ? hide : show}
      type="button"
    >
      <EyeIcon off={shown} />
    </button>
  );
}

/** Stroke eye / eye-off — a drawn symbol, not an emoji (renders identically everywhere). */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      aria-hidden
      fill="none"
      height="20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
      width="20"
    >
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
          <line x1="1" x2="23" y1="1" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

type PasswordRuleId = "length" | "upper" | "lower" | "digit" | "symbol";

/**
 * Password policy (REQ-AUTH-07): min 8 chars, plus — per the founder decision —
 * upper + lower + digit + symbol. Mirrors the Supabase server rule
 * `password_requirements = lower_upper_letters_digits_symbols`, so the client
 * shows the rules live instead of letting the server reject after submit. The
 * checklist is shown only where a password is CREATED (register + set-new-
 * password), never on the plain sign-in field where an existing one is entered.
 * Labels come from the dictionary via `PasswordCopy` (keyed by rule id).
 */
const PASSWORD_RULES: ReadonlyArray<{ id: PasswordRuleId; test: (p: string) => boolean }> = [
  { id: "length", test: (p) => p.length >= 8 },
  { id: "upper", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", test: (p) => /[a-z]/.test(p) },
  { id: "digit", test: (p) => /[0-9]/.test(p) },
  { id: "symbol", test: (p) => /[^A-Za-z0-9]/.test(p) }
];

export function passwordMeetsPolicy(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

export function PasswordChecklist({ value, copy }: { value: string; copy: PasswordCopy }) {
  return (
    <ul
      aria-label={copy.aria}
      className="grid gap-1 rounded-lg border border-border bg-muted px-3 py-2.5"
    >
      <li className="text-xs font-semibold text-muted-foreground">{copy.heading}</li>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);

        return (
          <li
            className={`flex items-center gap-2 text-xs leading-5 ${
              ok ? "text-primary" : "text-muted-foreground"
            }`}
            key={rule.id}
          >
            <span aria-hidden className="w-3 shrink-0 font-semibold">
              {ok ? <Check size={12} strokeWidth={3} /> : <Circle size={10} strokeWidth={2} />}
            </span>
            <span>{copy[rule.id]}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** One text field for the panel: string in / string out, validation message underneath. */
function TextInput({
  autoComplete,
  disabled,
  endPadding = false,
  error,
  inputMode,
  maxLength,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  autoComplete?: string;
  disabled?: boolean;
  /** Leave room on the right for an overlaid control (the password reveal button). */
  endPadding?: boolean;
  /** Validation message: shown under the field, which turns red. */
  error?: string;
  inputMode?: "email" | "tel";
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "email" | "password" | "tel" | "text";
  value: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Input
        aria-invalid={error ? true : undefined}
        aria-label={placeholder}
        autoComplete={autoComplete}
        className={cn("h-11", endPadding && "pr-11")}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Smart-Simplicity login (auth roadmap): sign-in stays unified for Corporate and
 * NGO — Google/OAuth (one click), email + password, magic-link fallback. But
 * REGISTRATION branches by role: a new user first picks NGO or company, because
 * the two paths genuinely differ (NGO is free + verified; company is a set-up,
 * paid workspace). The choice is stored as `requested_role` signup metadata so
 * provisioning knows the intent — the foundation for moving NGO registration
 * in-app and sunsetting the external Tally form. Workspace access stays gated
 * (invite/provisioning + NGO verification) after sign-up; picking "NGO" only
 * records intent, it does not grant a free workspace until Ops verifies.
 */
export function SmartLoginPanel({
  config,
  register,
  password: passwordCopy,
  panel,
  locale,
  onModeChange
}: {
  config: SupabaseBrowserConfig | null;
  register?: RegisterCopy;
  password?: PasswordCopy;
  panel: PanelCopy;
  locale: "en" | "de";
  /** Lets the surrounding page follow sign-in / sign-up (e.g. its heading). */
  onModeChange?: (mode: "signin" | "signup") => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => (config ? getBrowserSupabaseClient(config) : null), [config]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);
  const [requestedRole, setRequestedRole] = useState<RequestedRole | null>(null);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [salutation, setSalutation] = useState("");
  const [academicTitle, setAcademicTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  // Recipient organization type (ADR 0030). NGO branch only.
  const [orgType, setOrgType] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Validation problems belong to a field: the message sits under it and the field turns red.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const edit =
    <T,>(key: FieldKey, set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setFieldErrors((current) => {
        if (!current[key]) return current;
        const { [key]: _removed, ...rest } = current;
        void _removed;
        return rest;
      });
    };
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Bumped after each auth attempt to force the Turnstile widget to mint a fresh
  // single-use token; see resetCaptcha() below.
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  // Set when a sign-in is rejected because the e-mail isn't confirmed yet — the
  // panel then offers a "resend confirmation" action for that address.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Arriving via the password-reset email link: stay on this panel and let
      // the user set a new password instead of bouncing into the workspace.
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        return;
      }
      if (session) router.refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, router]);

  // If the user arrives already signed in but still at aal1 with a verified
  // factor (e.g. after a Google / magic-link return), surface the 2FA challenge.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active || !sessionData.session) return;
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data?.currentLevel === "aal1" && aal.data?.nextLevel === "aal2") {
        const factors = await supabase.auth.mfa.listFactors();
        const totp = factors.data?.totp.find((factor) => factor.status === "verified");
        if (active && totp) setMfaFactorId(totp.id);
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  if (!config || !supabase) {
    return (
      <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        {panel.unavailable}
      </p>
    );
  }
  const client = supabase;

  // When Turnstile is configured, every unauthenticated auth call needs a token.
  const captchaOpt = captchaToken ? { captchaToken } : {};
  function captchaOk(): boolean {
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setMessage(panel.captchaRequired);
      return false;
    }
    return true;
  }
  // A Turnstile token is single-use. After any auth call that consumed it and
  // left the user on this panel (failure, or magic-link/reset "sent"), drop the
  // spent token and bump the nonce so the widget issues a fresh one — otherwise
  // the next attempt re-sends the spent token and the server rejects it.
  function resetCaptcha() {
    if (!TURNSTILE_SITE_KEY) return;
    setCaptchaToken(null);
    setCaptchaNonce((n) => n + 1);
  }

  function redirectTo(): string {
    const url = new URL(window.location.href);
    url.hash = "";
    return url.toString();
  }

  async function withGoogle() {
    setPending("google");
    setMessage(null);
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() }
    });
    if (error) {
      toast.error(`${panel.googleFailed} ${error.message}`);
      setPending(null);
    }
  }

  async function withPassword() {
    const normalizedEmail = email.trim().toLowerCase();
    setFieldErrors({});
    if (!normalizedEmail || !password) {
      setFieldErrors({
        ...(normalizedEmail ? {} : { email: panel.enterEmail }),
        ...(password ? {} : { password: panel.enterPassword })
      });
      return;
    }
    if (!captchaOk()) return;
    setPending("password");
    setMessage(null);
    if (mode === "signup") {
      const agreement = requestedRole === "ngo" ? NGO_PARTNER_AGREEMENT : SAAS_TERMS;
      // In the role-branched register flow the two documents (privacy + the
      // role's agreement) must be confirmed — the same confirmations the Tally
      // form captures — before an account is created.
      if (requestedRole && register && orgName.trim().length < 2) {
        setPending(null);
        setFieldErrors({ orgName: register.orgNameMissing });
        return;
      }
      if (requestedRole && register && !["herr", "frau", "divers"].includes(salutation)) {
        setPending(null);
        setFieldErrors({ salutation: register.salutationMissing });
        return;
      }
      if (requestedRole && register && firstName.trim().length === 0) {
        setPending(null);
        setFieldErrors({ firstName: register.firstNameMissing });
        return;
      }
      if (requestedRole && register && lastName.trim().length === 0) {
        setPending(null);
        setFieldErrors({ lastName: register.lastNameMissing });
        return;
      }
      if (
        requestedRole === "ngo" &&
        register &&
        !["verein", "ggmbh", "stiftung", "public_body", "freier_traeger"].includes(orgType)
      ) {
        setPending(null);
        setFieldErrors({ orgType: register.orgTypeMissing });
        return;
      }
      // REQ-AUTH-03: companies register with their own domain. The database
      // refuses it again in claim_workspace (0031); this only says so early.
      if (requestedRole === "corporate" && register && isFreemailEmail(normalizedEmail)) {
        setPending(null);
        setFieldErrors({ email: register.corporateFreemail });
        return;
      }
      if (requestedRole && register && !(acceptedPrivacy && acceptedTerms)) {
        setPending(null);
        setFieldErrors({ consent: register.consentRequired });
        return;
      }
      const { error } = await client.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          ...captchaOpt,
          // Confirmation e-mail lands on the dedicated /registered page.
          emailRedirectTo: `${window.location.origin}/registered`,
          // Records the self-declared org type and the confirmed document
          // versions so provisioning/Ops knows the intended path and the
          // acceptance is auditable from sign-up. It grants nothing on its own —
          // NGO workspaces still require verification, corporate workspaces are
          // set up on onboarding, and the agreement is re-enforced server-side.
          data: requestedRole
            ? {
                requested_role: requestedRole,
                // Carried into claim_workspace() after e-mail confirmation, so
                // the workspace can be created without asking again.
                org_name: orgName.trim(),
                salutation,
                academic_title: academicTitle || undefined,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                // Recipient org type — NGO branch only (ADR 0030); read by
                // claim_workspace() to classify the ngos row and pick the proof.
                org_type: requestedRole === "ngo" ? orgType : undefined,
                contact_role: contactRole.trim() || undefined,
                phone: phone.trim() || undefined,
                accepted_privacy_version: PRIVACY_POLICY.version,
                accepted_agreement_kind: agreement.kind,
                accepted_agreement_version: agreement.version
              }
            : undefined
        }
      });
      setPending(null);
      if (error) {
        toast.error(authErrorMessage(error, panel));
        resetCaptcha();
      } else {
        // Dedicated confirmation page — works both for the immediate
        // (no-confirmation) case and after the e-mail confirmation link.
        router.push("/registered");
      }
    } else {
      const { error } = await client.auth.signInWithPassword({
        email: normalizedEmail,
        password,
        options: { ...captchaOpt }
      });
      if (error) {
        setPending(null);
        toast.error(authErrorMessage(error, panel));
        // An unconfirmed e-mail is recoverable in place: remember the address so
        // the panel can offer to resend the confirmation link.
        const unconfirmed = error.code === "email_not_confirmed" || error.message.toLowerCase().includes("not confirmed");
        setUnconfirmedEmail(unconfirmed ? normalizedEmail : null);
        resetCaptcha();
        return;
      }
      // A successful sign-in means the address is confirmed — clear any prior hint.
      setUnconfirmedEmail(null);
      // If the account has a verified second factor, step up to aal2.
      const aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data && aal.data.nextLevel === "aal2" && aal.data.nextLevel !== aal.data.currentLevel) {
        const factors = await client.auth.mfa.listFactors();
        const totp = factors.data?.totp.find((factor) => factor.status === "verified");
        if (totp) {
          setMfaFactorId(totp.id);
          setPending(null);
          return;
        }
      }
      setPending(null);
      router.refresh();
    }
  }

  async function verifyMfa() {
    if (!mfaFactorId) return;
    setPending("password");
    setMessage(null);
    const challenge = await client.auth.mfa.challenge({ factorId: mfaFactorId });
    if (challenge.error || !challenge.data) {
      setPending(null);
      toast.error(`${panel.mfaFailed} ${challenge.error?.message ?? "unknown error"}`);
      return;
    }
    const { error } = await client.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: challenge.data.id,
      code: mfaCode.trim()
    });
    setPending(null);
    if (error) {
      toast.error(`${panel.invalidCode} ${error.message}`);
      return;
    }
    router.refresh();
  }

  async function withMagicLink() {
    const normalizedEmail = email.trim().toLowerCase();
    setFieldErrors({});
    if (!normalizedEmail) {
      setFieldErrors({ email: panel.enterEmail });
      return;
    }
    if (!captchaOk()) return;
    setPending("link");
    setMessage(null);
    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { ...captchaOpt, emailRedirectTo: redirectTo() }
    });
    setPending(null);
    if (error) toast.error(authErrorMessage(error, panel));
    else toast.success(panel.magicLinkSent);
    // Sent or failed, the token is spent and the user stays here — mint a fresh
    // one so a resend/retry isn't rejected as a duplicate.
    resetCaptcha();
  }

  async function resendConfirmation() {
    if (!unconfirmedEmail) return;
    if (!captchaOk()) return;
    setPending("resend");
    setMessage(null);
    const { error } = await client.auth.resend({
      type: "signup",
      email: unconfirmedEmail,
      options: { emailRedirectTo: `${window.location.origin}/registered`, captchaToken: captchaToken ?? undefined }
    });
    setPending(null);
    if (error) toast.error(authErrorMessage(error, panel));
    else toast.success(panel.confirmationResent);
    // Confirmation mail consumes the token; mint a fresh one for any further try.
    resetCaptcha();
  }

  async function withPasswordReset() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setFieldErrors({ email: panel.enterEmailReset });
      return;
    }
    if (!captchaOk()) return;
    setPending("reset");
    setMessage(null);
    // Recovery gets its own page (not the inline panel): the reset link must land
    // on /reset-password, which handles the recovery session and the new-password
    // form. /login would bounce a recovered session straight to the workspace.
    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captchaToken ?? undefined
    });
    setPending(null);
    if (error) toast.error(authErrorMessage(error, panel));
    else toast.success(panel.resetSent);
    // Token spent, user stays here — mint a fresh one for any resend/retry.
    resetCaptcha();
  }

  async function updatePassword() {
    if (!passwordMeetsPolicy(newPassword)) {
      setMessage(passwordCopy?.incomplete ?? "Your password does not meet all requirements yet — see the list below.");
      return;
    }
    setPending("recover");
    setMessage(null);
    const { error } = await client.auth.updateUser({ password: newPassword });
    setPending(null);
    if (error) {
      toast.error(authErrorMessage(error, panel));
      return;
    }
    // A password change should not leave old sessions alive elsewhere. Revoke the
    // other devices' sessions (keeps this one). Best-effort — never block success.
    await client.auth.signOut({ scope: "others" }).catch(() => undefined);
    setRecoveryMode(false);
    setNewPassword("");
    toast.success(panel.passwordUpdated);
    router.refresh();
  }

  if (recoveryMode) {
    return (
      <div className="grid gap-3">
        <p className="text-sm font-semibold text-foreground">{panel.recoveryTitle}</p>
        <p className="text-sm leading-6 text-muted-foreground">{panel.recoveryLead}</p>
        <div className="relative">
          <Input
            autoComplete="new-password"
            className="w-full pr-11"
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder={panel.newPasswordPlaceholder}
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
          />
          <RevealButton
            hide={panel.hidePassword}
            onToggle={() => setShowNewPassword((v) => !v)}
            show={panel.showPassword}
            shown={showNewPassword}
          />
        </div>
        {passwordCopy ? <PasswordChecklist copy={passwordCopy} value={newPassword} /> : null}
        <Button disabled={pending !== null || !passwordMeetsPolicy(newPassword)} onClick={() => void updatePassword()} type="button">
          {pending === "recover" ? panel.recoverySaving : panel.recoverySet}
        </Button>
        <FormError message={message} />
      </div>
    );
  }

  if (mfaFactorId) {
    return (
      <div className="grid gap-3">
        <p className="text-lg font-semibold text-foreground">{panel.mfaTitle}</p>
        <p className="text-sm leading-6 text-muted-foreground">{panel.mfaLead}</p>
        <OtpField disabled={pending !== null} onChange={setMfaCode} onComplete={() => void verifyMfa()} value={mfaCode} />
        <Button disabled={pending !== null || mfaCode.trim().length < 6} onClick={() => void verifyMfa()} type="button">
          {pending === "password" ? panel.mfaVerifying : panel.mfaVerify}
        </Button>
        <FormError message={message} />
      </div>
    );
  }

  // text-base (16px) keeps iOS Safari from zooming on focus; the visible ring
  // is the a11y focus indicator (a bare border-colour change is too subtle).
  const field =
    "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 md:text-sm";

  // Registration branches by role: a new user picks NGO or company first.
  if (mode === "signup" && register && !requestedRole) {
    return (
      <div className="grid gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{register.chooseTitle}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{register.chooseLead}</p>
        </div>
        <button
          className="group flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-xs transition-colors hover:bg-accent"
          onClick={() => setRequestedRole("ngo")}
          type="button"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <Heart size={20} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-foreground">{register.ngo}</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">{register.ngoHint}</span>
          </span>
          <span aria-hidden="true" className="text-xl text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">
            <ArrowRight size={20} strokeWidth={2} />
          </span>
        </button>
        <button
          className="group flex w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-xs transition-colors hover:bg-accent"
          onClick={() => setRequestedRole("corporate")}
          type="button"
        >
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <Building2 size={20} strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold text-foreground">{register.corporate}</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">{register.corporateHint}</span>
          </span>
          <span aria-hidden="true" className="text-xl text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground">
            <ArrowRight size={20} strokeWidth={2} />
          </span>
        </button>
        <button
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setMode("signin")}
          type="button"
        >
          {panel.toSignin}
        </button>
      </div>
    );
  }

  const signupRoleLabel =
    requestedRole && register ? (requestedRole === "ngo" ? register.ngo : register.corporate) : null;
  const createLabel =
    requestedRole && register
      ? requestedRole === "ngo"
        ? register.continueNgo
        : register.continueCorporate
      : panel.createAccount;
  const inRegister = mode === "signup" && requestedRole !== null && register !== undefined;
  const consentOk = !inRegister || (acceptedPrivacy && acceptedTerms);
  const roleAgreement = requestedRole === "ngo" ? NGO_PARTNER_AGREEMENT : SAAS_TERMS;
  const roleAgreementLabel =
    register && (requestedRole === "ngo" ? register.consentTermsNgo : register.consentTermsCorporate);

  return (
    <div className="grid gap-3">
      {mode === "signup" && signupRoleLabel && register ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
          <span className="text-xs font-semibold text-foreground">{signupRoleLabel}</span>
          <button
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setRequestedRole(null);
              setAcceptedPrivacy(false);
              setAcceptedTerms(false);
            }}
            type="button"
          >
            {register.change}
          </button>
        </div>
      ) : null}
      {/*
        Google sign-in is hidden for now (product decision) but the OAuth path
        (`withGoogle`) and the Supabase provider stay intact — flip
        NEXT_PUBLIC_SURPLUS_GOOGLE_LOGIN=1 to bring the button back.
      */}
      {process.env.NEXT_PUBLIC_SURPLUS_GOOGLE_LOGIN === "1" ? (
        <>
          <Button variant="outline" disabled={pending !== null} onClick={() => void withGoogle()} type="button">
            {pending === "google" ? panel.googleRedirecting : panel.googleContinue}
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {panel.or}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      ) : null}

      {inRegister && register ? (
        <>
          <TextInput
            autoComplete="organization"
            disabled={pending !== null}
            maxLength={160}
            error={fieldErrors.orgName}
            onChange={edit("orgName", setOrgName)}
            placeholder={requestedRole === "ngo" ? register.orgNamePlaceholderNgo : register.orgNamePlaceholderCorporate}
            value={orgName}
          />
          {requestedRole === "ngo" ? (
            <div className="grid gap-1.5">
              <select
              aria-label={register.orgTypeLabel}
                aria-invalid={Boolean(fieldErrors.orgType)}
                className={`${field} ${fieldErrors.orgType ? "border-destructive" : ""}`}
              disabled={pending !== null}
                onChange={(event) => edit("orgType", setOrgType)(event.target.value)}
              value={orgType}
            >
              <option value="" disabled>
                {register.orgTypePlaceholder}
              </option>
              <option value="verein">{register.orgTypeVerein}</option>
              <option value="ggmbh">{register.orgTypeGgmbh}</option>
              <option value="stiftung">{register.orgTypeStiftung}</option>
              <option value="public_body">{register.orgTypePublicBody}</option>
              <option value="freier_traeger">{register.orgTypeFreierTraeger}</option>
              </select>
              <FieldMsg message={fieldErrors.orgType} />
            </div>
          ) : null}
          <hr className="my-1 border-border" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <select
              aria-label={register.salutationLabel}
                aria-invalid={Boolean(fieldErrors.salutation)}
                className={`${field} ${fieldErrors.salutation ? "border-destructive" : ""}`}
              disabled={pending !== null}
                onChange={(event) => edit("salutation", setSalutation)(event.target.value)}
              value={salutation}
            >
              <option value="" disabled>
                {register.salutationPlaceholder}
              </option>
              <option value="herr">{register.salutationHerr}</option>
              <option value="frau">{register.salutationFrau}</option>
              <option value="divers">{register.salutationDivers}</option>
              </select>
              <FieldMsg message={fieldErrors.salutation} />
            </div>
            <select
              aria-label={register.academicTitleLabel}
              className={field}
              disabled={pending !== null}
              onChange={(event) => setAcademicTitle(event.target.value)}
              value={academicTitle}
            >
              <option value="">{register.academicTitleNone}</option>
              <option value="Dr.">Dr.</option>
              <option value="Prof.">Prof.</option>
              <option value="Prof. Dr.">Prof. Dr.</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
            autoComplete="given-name"
            disabled={pending !== null}
            maxLength={80}
            error={fieldErrors.firstName}
            onChange={edit("firstName", setFirstName)}
            placeholder={register.firstNamePlaceholder}
            value={firstName}
          />
            <TextInput
            autoComplete="family-name"
            disabled={pending !== null}
            maxLength={80}
            error={fieldErrors.lastName}
            onChange={edit("lastName", setLastName)}
            placeholder={register.lastNamePlaceholder}
            value={lastName}
          />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
            autoComplete="organization-title"
            disabled={pending !== null}
            maxLength={80}
            onChange={setContactRole}
            placeholder={register.rolePlaceholder}
            value={contactRole}
          />
            <TextInput
            autoComplete="tel"
            disabled={pending !== null}
            inputMode="tel"
            maxLength={30}
            onChange={setPhone}
            placeholder={register.phonePlaceholder}
            value={phone}
          />
          </div>
          <hr className="my-1 border-border" />
        </>
      ) : null}
      <TextInput
        autoComplete="email"
        disabled={pending !== null}
        inputMode="email"
        error={fieldErrors.email}
        onChange={edit("email", (next: string) => {
          setEmail(next);
          // A different address invalidates the "resend confirmation" hint.
          if (unconfirmedEmail) setUnconfirmedEmail(null);
        })}
        placeholder={panel.emailPlaceholder}
        type="email"
        value={email}
      />
      <div className="relative">
        <TextInput
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            disabled={pending !== null}
            endPadding
            error={fieldErrors.password}
            onChange={edit("password", setPassword)}
            placeholder={panel.passwordPlaceholder}
            type={showPassword ? "text" : "password"}
            value={password}
          />
        <RevealButton
          hide={panel.hidePassword}
          onToggle={() => setShowPassword((v) => !v)}
          show={panel.showPassword}
          shown={showPassword}
        />
      </div>
      {inRegister && passwordCopy ? <PasswordChecklist copy={passwordCopy} value={password} /> : null}
      {mode === "signin" ? (
        <div className="-mt-1 flex items-center justify-between gap-3">
          <button
            className="text-xs text-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending !== null}
            onClick={() => void withMagicLink()}
            type="button"
          >
            {pending === "link" ? panel.sending : panel.magicLink}
          </button>
          <button
            className="text-xs text-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            disabled={pending !== null}
            onClick={() => void withPasswordReset()}
            type="button"
          >
            {pending === "reset" ? panel.sending : panel.forgotPassword}
          </button>
        </div>
      ) : null}
      {inRegister && register ? (
        <div className={`grid gap-2 rounded-lg border bg-muted px-3 py-2.5 ${fieldErrors.consent ? "border-destructive/40" : "border-border"}`}>
          <p className="text-xs font-semibold text-muted-foreground">{register.consentLead}</p>
          <CheckField checked={acceptedPrivacy} onChange={edit("consent", setAcceptedPrivacy)}>
          {register.consentBefore}{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={PRIVACY_POLICY.termsHref}
            rel="noreferrer"
            target="_blank"
          >
            {register.consentPrivacyLink}
          </a>{" "}
          ({PRIVACY_POLICY.version}).
          </CheckField>
          <CheckField checked={acceptedTerms} onChange={edit("consent", setAcceptedTerms)}>
          {register.consentBefore}{" "}
          <a
            className="text-foreground underline-offset-2 hover:underline"
            href={roleAgreement.termsHref}
            rel="noreferrer"
            target="_blank"
          >
            {roleAgreementLabel}
          </a>{" "}
          ({roleAgreement.version}).
          </CheckField>
          <FieldMsg message={fieldErrors.consent} />
        </div>
      ) : null}

      {TURNSTILE_SITE_KEY ? (
        <TurnstileWidget
          language={locale}
          onToken={setCaptchaToken}
          resetSignal={captchaNonce}
          siteKey={TURNSTILE_SITE_KEY}
        />
      ) : null}

      <Button disabled={pending !== null || !consentOk || (inRegister && !passwordMeetsPolicy(password))} onClick={() => void withPassword()} size="lg" className="w-full">
        {pending === "password" ? panel.working : mode === "signup" ? createLabel : panel.signIn}
      </Button>

      {mode === "signin" && unconfirmedEmail ? (
        <Button variant="outline" disabled={pending !== null} onClick={() => void resendConfirmation()} type="button">
          {pending === "resend" ? panel.sending : panel.resendConfirmation}
        </Button>
      ) : null}

      <Button onClick={() => { setMode((current) => (current === "signin" ? "signup" : "signin")); setRequestedRole(null); setAcceptedPrivacy(false); setAcceptedTerms(false); setMessage(null); setUnconfirmedEmail(null); }} size="lg" variant="outline" className="w-full">
        {mode === "signin" ? panel.toSignup : panel.toSignin}
      </Button>

      <FormError message={message} />
    </div>
  );
}

/** Validation problems stay on the form, next to what needs fixing; API results are toasts. */
function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm leading-5 text-destructive" role="alert">
      {message}
    </p>
  );
}

/** The error line under a field (HeroUI inputs render their own). */
function FieldMsg({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="px-1 text-xs leading-4 text-destructive" role="alert">
      {message}
    </p>
  );
}

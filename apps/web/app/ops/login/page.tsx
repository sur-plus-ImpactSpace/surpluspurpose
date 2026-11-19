import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "../../components/AdminLoginForm";
import { LoginHero, LoginShell } from "../../components/shell/LoginShell";
import { getDictionary } from "../../lib/i18n";
import { loadLoginHeadline } from "../../lib/login-headline";
import { supabaseBrowserConfigFromEnv } from "../../lib/service-chat-realtime";
import { loadServerSupabaseSession } from "../../lib/server-supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "sur.plus · Admin sign in"
};

/** The admin area's own front door: sign in only, no registration or request-access. */
export default async function AdminLoginPage() {
  const config = supabaseBrowserConfigFromEnv();
  if (!config) redirect("/demo");
  // A session that still owes the 6-digit code stays here (on the code step); a complete one goes in.
  const session = await loadServerSupabaseSession(config);
  if (session && !session.mfaRequired) redirect("/ops");

  const t = getDictionary("en");
  const headline = await loadLoginHeadline();

  return (
    <LoginShell hideLanguage locale="en" t={t} hero={<LoginHero headline={headline} locale="en" t={t} />}>
      <p className="text-[11px] font-medium text-muted-foreground">sur.plus admin</p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">Admin sign in</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
        Access for sur.plus administrators. Accounts are created by invitation only.
      </p>
      <div className="mt-6">
        <AdminLoginForm config={config} needsCode={Boolean(session?.mfaRequired)} />
      </div>
    </LoginShell>
  );
}

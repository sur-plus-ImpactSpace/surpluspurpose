import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetPasswordForm } from "../../components/SetPasswordForm";
import { LoginHero, LoginShell } from "../../components/shell/LoginShell";
import { getDictionary } from "../../lib/i18n";
import { loadLoginHeadline } from "../../lib/login-headline";
import { supabaseBrowserConfigFromEnv } from "../../lib/service-chat-realtime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "sur.plus · Set your password"
};

export default async function AdminSetPasswordPage() {
  const config = supabaseBrowserConfigFromEnv();
  if (!config) redirect("/demo");

  const t = getDictionary("en");
  const headline = await loadLoginHeadline();

  return (
    <LoginShell hideLanguage locale="en" t={t} hero={<LoginHero headline={headline} locale="en" t={t} />}>
      <p className="text-[11px] font-medium text-muted-foreground">sur.plus admin</p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">Welcome. Set your password</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">You were invited as an administrator. Choose a password to finish.</p>
      <div className="mt-6">
        <SetPasswordForm config={config} />
      </div>
    </LoginShell>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordPanel } from "../components/ResetPasswordPanel";
import { LoginHero, LoginShell } from "../components/shell/LoginShell";
import { getDictionary, resolveLocale } from "../lib/i18n";
import { loadLoginHeadline } from "../lib/login-headline";
import { supabaseBrowserConfigFromEnv } from "../lib/service-chat-realtime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Reset password"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Dedicated password-recovery surface. The reset e-mail links here so the
 * recovery session lands on its own page — unlike /login, this route never
 * bounces an authenticated session into the workspace, so the user always gets
 * the "set a new password" form. The recovery session itself is established
 * client-side from the URL by `ResetPasswordPanel`.
 */
export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const locale = resolveLocale(params.lang);
  const t = getDictionary(locale);
  const authConfig = supabaseBrowserConfigFromEnv();

  // No auth backend → this deployment is the demo; there is nothing to reset.
  if (!authConfig) redirect("/demo");

  const headline = await loadLoginHeadline();

  return (
    <LoginShell locale={locale} t={t} hero={<LoginHero headline={headline} locale={locale} t={t} />}>
      <ResetPasswordPanel config={authConfig} panel={t.auth.panel} password={t.auth.password} />
    </LoginShell>
  );
}

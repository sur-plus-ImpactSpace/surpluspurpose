import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisteredPanel } from "../components/RegisteredPanel";
import { LoginHero, LoginShell } from "../components/shell/LoginShell";
import { getDictionary, resolveLocale } from "../lib/i18n";
import { loadLoginHeadline } from "../lib/login-headline";
import { supabaseBrowserConfigFromEnv } from "../lib/service-chat-realtime";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Registered"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Post-registration confirmation page. The sign-up flow redirects here after the
 * form is submitted, and the confirmation e-mail links here too — so a new user
 * always gets an explicit "you're registered" screen. Whether a session exists
 * (decided client-side by `RegisteredPanel`) picks the "continue into the app"
 * vs "confirm your e-mail" message.
 */
export default async function RegisteredPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const locale = resolveLocale(params.lang);
  const t = getDictionary(locale);
  const authConfig = supabaseBrowserConfigFromEnv();

  // No auth backend → this deployment is the demo; there is nothing to register.
  if (!authConfig) redirect("/demo");

  const headline = await loadLoginHeadline();

  return (
    <LoginShell locale={locale} t={t} hero={<LoginHero headline={headline} locale={locale} t={t} />}>
      <RegisteredPanel config={authConfig} copy={t.auth.registered} />
    </LoginShell>
  );
}

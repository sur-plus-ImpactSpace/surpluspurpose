import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginContent } from "../components/LoginContent";
import { LoginHero, LoginShell } from "../components/shell/LoginShell";
import { getDictionary, resolveLocale } from "../lib/i18n";
import { loadLoginHeadline } from "../lib/login-headline";
import { supabaseBrowserConfigFromEnv } from "../lib/service-chat-realtime";
import { loadServerSupabaseSession } from "../lib/server-supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Sign in"
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const inviteToken = inviteTokenFromParams(params);
  const locale = resolveLocale(params.lang);
  const t = getDictionary(locale);
  const authConfig = supabaseBrowserConfigFromEnv();

  // Pure demo deployments have no auth backend — the sandbox is the product.
  if (!authConfig) redirect("/demo");

  const session = await loadServerSupabaseSession(authConfig);
  if (session && !session.mfaRequired) {
    redirect(inviteToken ? `/?invite_token=${encodeURIComponent(inviteToken)}` : "/");
  }

  const headline = await loadLoginHeadline();

  return (
    <LoginShell
      footerExtra={
        <>
          {" "}
          ·{" "}
          <Link
            className="underline-offset-2 hover:underline"
            href={locale === "de" ? "/request-access?lang=de" : "/request-access"}
          >
            {t.requestAccess.link}
          </Link>{" "}
          ·{" "}
          <a
            className="underline-offset-2 hover:underline"
            href="https://calendly.com/florian_surplus/30min"
            rel="noreferrer"
            target="_blank"
          >
            {t.auth.accessCta}
          </a>
        </>
      }
      locale={locale}
      t={t}
      hero={<LoginHero headline={headline} locale={locale} t={t} />}
    >
      {(Array.isArray(params.link) ? params.link[0] : params.link) === "invalid" ? (
        <p className="mb-4 rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm text-muted-foreground" role="alert">
          That link has expired or was already used. Sign in, or request a new email.
        </p>
      ) : null}

      {inviteToken ? (
        <p className="mt-4 rounded-lg border border-primary bg-muted px-3.5 py-2.5 text-sm text-muted-foreground">
          {t.auth.inviteNotice}
        </p>
      ) : null}

      {/*
        Open registration: anyone arriving from the landing page's "Register"
        can create an account here (role-branched NGO vs company with document
        confirmations). Workspace access is still verification-gated after
        sign-up — NGOs are verified, corporate workspaces are provisioned —
        but the door is open.
      */}
      <LoginContent
        config={authConfig}
        eyebrow={t.auth.eyebrow}
        locale={locale}
        panel={t.auth.panel}
        password={t.auth.password}
        register={t.auth.register}
        subtitle={t.auth.subtitle}
        title={t.auth.title}
      />

    </LoginShell>
  );
}

function inviteTokenFromParams(params: SearchParams): string | null {
  const raw = params.invite_token;
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value?.trim() || null;
}

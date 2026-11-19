import type { Metadata } from "next";
import { RequestAccessForm } from "../components/RequestAccessForm";
import { LoginHero, LoginShell } from "../components/shell/LoginShell";
import { getDictionary, resolveLocale } from "../lib/i18n";
import { loadLoginHeadline } from "../lib/login-headline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Request access"
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Public lead capture for visitors without an invitation (REQ-AUTH-05). */
export default async function RequestAccessPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const locale = resolveLocale(params.lang);
  const t = getDictionary(locale);
  const headline = await loadLoginHeadline();

  return (
    <LoginShell locale={locale} t={t} hero={<LoginHero headline={headline} locale={locale} t={t} />}>
      <p className="text-[11px] font-medium text-muted-foreground">
        {t.requestAccess.eyebrow}
      </p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{t.requestAccess.title}</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{t.requestAccess.lead}</p>
      <div className="mt-6">
        <RequestAccessForm copy={t.requestAccess} />
      </div>
    </LoginShell>
  );
}

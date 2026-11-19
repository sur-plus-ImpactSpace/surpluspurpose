import { Building2, Heart, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmitButton } from "../../components/SubmitButton";
import { LoginHero, LoginShell } from "../../components/shell/LoginShell";
import { getDictionary, resolveLocale } from "../../lib/i18n";
import { loadLoginHeadline } from "../../lib/login-headline";
import { demoAccessAllowed } from "../demo-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "sur.plus · Start the demo"
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The demo's own front door, separate from sign-in. Starting it creates a private
 * sandbox for this visitor (POST /demo/enter); the sandbox is cleaned up on its own.
 */
export default async function DemoStartPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const key = first(params.key);
  if (!demoAccessAllowed(key)) redirect("/login");

  const locale = resolveLocale(params.lang);
  const t = getDictionary(locale);
  const headline = await loadLoginHeadline();

  return (
    <LoginShell locale={locale} t={t} hero={<LoginHero headline={headline} locale={locale} t={t} />}>
      <p className="text-[11px] font-medium text-muted-foreground">{t.demoStart.eyebrow}</p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{t.demoStart.title}</h1>
      <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{t.demoStart.lead}</p>
      {first(params.expired) ? (
        <p className="mt-4 rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm text-muted-foreground" role="status">
          {t.demoStart.expired}
        </p>
      ) : null}

      <form action="/demo/enter" className="mt-6 grid gap-4" method="post">
        {key ? <input name="key" type="hidden" value={key} /> : null}
        <input name="lang" type="hidden" value={locale} />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t.demoStart.pick}</legend>
          {(
            [
              ["corporate", t.demoStart.corporate, Building2],
              ["ngo", t.demoStart.ngo, Heart],
              ["admin", t.demoStart.admin, ShieldCheck]
            ] as const
          ).map(([value, label, Icon], index) => (
            <label className="relative cursor-pointer" key={value}>
              <input className="peer sr-only" defaultChecked={index === 0} name="role" type="radio" value={value} />
              <span className="flex items-center gap-3 rounded-lg border bg-card p-3.5 text-sm font-medium text-foreground transition-colors peer-checked:border-primary peer-checked:bg-accent peer-checked:[&>span]:bg-primary peer-checked:[&>span]:text-primary-foreground peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50">
                <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <Icon size={18} strokeWidth={2} />
                </span>
                {label}
              </span>
            </label>
          ))}
        </fieldset>
        <SubmitButton>{t.demoStart.start}</SubmitButton>
        <p className="text-xs text-muted-foreground">{t.demoStart.note}</p>
      </form>
    </LoginShell>
  );
}

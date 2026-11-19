import type { ReactNode } from "react";
import type { LoginHeadline } from "../../lib/login-headline";
import type { Dictionary, Locale } from "../../lib/i18n";
import { DestructionTicker } from "../DestructionTicker";
import { LanguageSwitcher } from "../LanguageSwitcher";

/**
 * Sign-in chrome: a brand column with the one honest impact figure on the left,
 * the form in a card on the right (the column is hidden on phones). Every
 * pre-workspace screen uses it: sign-in, registration, password reset and the
 * provisioning / role-boundary states.
 */
export function LoginShell({
  children,
  footerExtra,
  hero,
  hideLanguage = false,
  locale,
  t,
  topbarRight
}: {
  children: ReactNode;
  /** Extra links in the page footer, after Imprint and Privacy. */
  footerExtra?: ReactNode;
  /** Pages that exist in one language only (the admin sign-in) show no language switch. */
  hideLanguage?: boolean;
  hero: ReactNode;
  locale: Locale;
  t: Dictionary;
  topbarRight?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2" lang={locale}>
      {hero}

      <div className="flex min-h-screen flex-col">
        <header className="flex h-14 items-center justify-between px-4 sm:px-6 lg:justify-end">
          <a className="text-base font-semibold tracking-tight lg:hidden" href="/">
            sur.plus
          </a>
          <div className="flex items-center gap-3">
            {topbarRight}
            {hideLanguage ? null : <LanguageSwitcher current={locale} />}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xs sm:p-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight">{children}</div>
        </main>

        <footer className="px-4 py-5 text-center" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
          <p className="text-xs text-muted-foreground">
            <a className="underline-offset-4 hover:underline focus-visible:underline" href="/imprint">
              {t.shell.imprint}
            </a>{" "}
            ·{" "}
            <a className="underline-offset-4 hover:underline focus-visible:underline" href="/privacy">
              {t.shell.privacy}
            </a>
            {footerExtra}
          </p>
        </footer>
      </div>
    </div>
  );
}

/**
 * The impact band under the header. Shows the realised, audited value moved to
 * NGOs when we have it; otherwise the honest ticker. Never a fabricated number.
 */
export function LoginHero({
  headline,
  locale,
  t
}: {
  headline: LoginHeadline | null;
  locale: Locale;
  t: Dictionary;
}) {
  const hero = t.auth.hero;
  const value = headline
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0
      }).format(headline.valueEur)
    : null;

  return (
    <section className="relative hidden flex-col justify-between overflow-hidden bg-linear-to-br from-[#24755b] via-[#113b2e] to-[#0a2a20] p-10 text-white lg:flex">
      <img alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full object-cover opacity-15" src="/surplus-warehouse.webp" />
      <img alt="" aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-15" src="/network-map.svg" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent to-black/40" />
      <a className="relative text-lg font-semibold tracking-tight" href="/">
        sur.plus
      </a>

      {value ? (
        <dl className="relative grid max-w-md grid-cols-2 gap-x-10 gap-y-8">
          <HeroStat value={`${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(headline!.co2Tons)} t`} label={hero.statCo2} />
          <HeroStat value={value} label={hero.eyebrow} />
          <HeroStat value={new Intl.NumberFormat(locale).format(headline!.ngos)} label={hero.statNgos} />
          <HeroStat value={`${new Intl.NumberFormat(locale).format(headline!.weightKg)} kg`} label={hero.statWeight} />
        </dl>
      ) : (
        <div className="relative"><DestructionTicker caption={t.auth.ticker.caption} eyebrow={t.auth.ticker.eyebrow} locale={locale} /></div>
      )}

      {/* Illustrative example matches: demo content, kept in English on every locale. */}
      <div className="relative">
        <p className="text-xs font-medium text-white/70">Illustrative example matches</p>
        <ul className="mt-2 space-y-1 text-sm text-white/70">
          <li><span className="text-white">London → Warsaw</span> · 200 desks</li>
          <li><span className="text-white">Brussels → Lisbon</span> · 320 laptops</li>
          <li><span className="text-white">Zurich → Lesbos</span> · 8,000 garments</li>
        </ul>
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-4xl font-semibold tabular-nums tracking-tight">{value}</dd>
      <p aria-hidden className="mt-1 text-sm text-white/75">
        {label}
      </p>
    </div>
  );
}

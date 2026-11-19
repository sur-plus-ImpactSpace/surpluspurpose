"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, LOCALES, resolveLocale } from "../lib/i18n";

/**
 * EN/DE switch usable on any page. It rewrites only the `lang` query parameter
 * on the current path and preserves everything else (e.g. an invite token), so
 * the same control works in every shell without per-page wiring.
 *
 * `useSearchParams` needs a Suspense boundary to keep statically-rendered pages
 * (the legal pages) from bailing out of prerendering — hence the wrapper.
 */
export function LanguageSwitcher({ current }: { current?: string }) {
  return (
    <Suspense fallback={<LanguageSwitcherFallback />}>
      <LanguageSwitcherInner current={current} />
    </Suspense>
  );
}

/** `current` is the language the page was actually rendered in (query or saved cookie, resolved on the server). */
function LanguageSwitcherInner({ current: rendered }: { current?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = rendered ?? resolveLocale(searchParams.get("lang") ?? undefined);

  function hrefFor(locale: string): string {
    const params = new URLSearchParams(searchParams.toString());
    // "en" is the default — keep the URL clean by dropping the param for it.
    if (locale === "en") {
      params.delete("lang");
    } else {
      params.set("lang", locale);
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  // Persist the choice so it survives in-app navigation that drops `?lang=`
  // (sidebar/mobile nav links). The server reads this cookie when no query
  // param is present. 1-year, lax, path=/ — chrome preference, no PII.
  function persist(locale: string): void {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <nav aria-label="Language">
      <div className="flex gap-0.5 rounded-md border bg-muted p-0.5">
        {LOCALES.map((item) => {
          const active = item === current;

          return (
            <Link
              aria-current={active ? "true" : undefined}
              className={cn("rounded-sm px-2.5 py-1 text-xs font-medium uppercase transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground")}
              href={hrefFor(item)}
              hrefLang={item}
              key={item}
              onClick={() => persist(item)}
            >
              {item}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Same footprint as the live control so the header does not jump on hydration. */
function LanguageSwitcherFallback() {
  return (
    <div className="flex gap-0.5 rounded-md border bg-muted p-0.5">
      {LOCALES.map((item) => (
        <span
          className="rounded-sm px-2.5 py-1 text-xs font-medium uppercase text-muted-foreground"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

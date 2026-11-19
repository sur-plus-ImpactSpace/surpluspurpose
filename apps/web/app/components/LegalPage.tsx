import type { ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";

type LegalLocale = "de" | "en";

/**
 * The legal pages are the one place in the app where a document that exists but
 * is not linked is as good as missing — a consumer who is never shown the
 * withdrawal instruction has not been instructed. So the footer lists all five,
 * and it grew from two when the recipient terms and the withdrawal instruction
 * were added in 2026-08.
 *
 * `locale` is passed in rather than resolved here: the pages already resolve it
 * (query param, then cookie) to pick which text to render, and reading it twice
 * risks the footer disagreeing with the body.
 */
const FOOTER_LINKS: Record<LegalLocale, { href: string; label: string }[]> = {
  de: [
    { href: "/imprint?lang=de", label: "Impressum" },
    { href: "/privacy?lang=de", label: "Datenschutz" },
    { href: "/terms?lang=de", label: "AGB" },
    { href: "/recipient-terms?lang=de", label: "Empfängerbedingungen" },
    { href: "/withdrawal?lang=de", label: "Widerruf" }
  ],
  en: [
    { href: "/imprint", label: "Imprint" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/recipient-terms", label: "Recipients" },
    { href: "/withdrawal", label: "Withdrawal" }
  ]
};

/**
 * Shared shell for the app's legal pages: calm, readable, no dashboard chrome.
 * Content is typographic HTML via the `legal` styles.
 */
export function LegalPage({
  children,
  kicker,
  locale = "en",
  title
}: {
  children: ReactNode;
  kicker: string;
  locale?: LegalLocale;
  title: string;
}) {
  const links = FOOTER_LINKS[locale];

  return (
    <main className="min-h-screen bg-background px-5 py-10 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <a className="text-sm font-semibold text-primary underline-offset-2 hover:underline" href="/">
            &larr; sur.plus
          </a>
          <LanguageSwitcher current={locale} />
        </div>
        <p className="mt-6 text-xs font-medium text-primary">{kicker}</p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <div className="legal mt-6 grid gap-4 text-sm leading-7 text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_.note]:rounded-sm [&_.note]:border [&_.note]:border-border [&_.note]:bg-muted [&_.note]:p-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
          {children}
        </div>
        <p className="mt-10 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {links.map((link, index) => (
            <span key={link.href}>
              <a className="underline-offset-2 hover:underline" href={link.href}>
                {link.label}
              </a>
              {index < links.length - 1 ? <span aria-hidden="true"> ·</span> : null}
            </span>
          ))}
        </p>
      </div>
    </main>
  );
}

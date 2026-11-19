import { resolveCategoryResources } from "../../lib/category-resources";
import type { Dictionary, Locale } from "../../lib/i18n";

/**
 * Category-conditional enrichment for the receiving NGO. Renders a curated
 * resource block (IT → open-source software pack; furniture/textiles/tools →
 * handling tips) for the delivered goods' category, or nothing when no group
 * applies. Recipient-facing value — deliberately separate from the audit-grade
 * CSRD report.
 */
export function CategoryResourcesPanel({
  category,
  locale,
  t
}: {
  category: string | null | undefined;
  locale: Locale;
  t: Dictionary;
}) {
  const group = resolveCategoryResources(category);
  if (!group) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
      <p className="text-[11px] font-medium">
        {t.resources.eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold sm:text-xl">{t.resources.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">{group.intro[locale]}</p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {group.items.map((item) => (
          <li key={item.name} className="rounded-lg border border-border bg-muted/40 px-3.5 py-3">
            {item.url ? (
              <a
                className="text-sm font-semibold text-foreground underline-offset-2 hover:underline"
                href={item.url}
                rel="noreferrer"
                target="_blank"
              >
                {item.name} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className="text-sm font-semibold text-foreground">{item.name}</span>
            )}
            <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{item.note[locale]}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

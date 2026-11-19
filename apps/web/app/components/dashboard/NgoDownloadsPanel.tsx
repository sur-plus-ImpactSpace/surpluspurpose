import {
  STARTER_BUNDLES,
  STARTER_LOCALES,
  STARTER_SOFTWARE,
  STARTER_TEMPLATES
} from "../../lib/ngo-starter";

/**
 * NGO starter package (D6.2). Static assets from /public — no DB, no client JS.
 * The payload is non-sensitive (blank templates + links to public downloads),
 * so it is not gated behind a route.
 */
export function NgoDownloadsPanel() {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium text-primary">
            Starter package
          </p>
          <h2 className="mt-2 text-xl font-semibold">Get set up with what you received</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Templates for the paperwork the platform does not generate for you, plus the
            open-source software we recommend for donated hardware. Every template is
            available in German and English.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {STARTER_LOCALES.map(({ label, locale }) => (
            <a
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              download
              href={STARTER_BUNDLES[locale]}
              key={locale}
            >
              All ({label})
            </a>
          ))}
        </div>
      </div>

      <p className="mt-5 text-xs font-medium text-muted-foreground">
        Templates
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {STARTER_TEMPLATES.map((template) => (
          <div
            className="rounded-lg border border-border bg-muted p-4"
            key={template.key}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-foreground">{template.title}</p>
              <span className="rounded-sm bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {template.format}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{template.description}</p>
            <div className="mt-3 flex gap-2">
              {STARTER_LOCALES.map(({ label, locale }) => (
                <a
                  className="rounded-sm border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:border-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  download
                  href={template.files[locale]}
                  key={locale}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs font-medium text-muted-foreground">
        Recommended open-source software
      </p>
      <div className="mt-3 grid gap-2">
        {STARTER_SOFTWARE.map((item) => (
          <a
            className="grid grid-cols-[minmax(0,1fr)] gap-1 rounded-lg border border-border bg-muted p-3 transition-colors hover:border-primary focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3"
            href={item.href}
            key={item.name}
            rel="noreferrer"
            target="_blank"
          >
            <div>
              <p className="font-semibold text-foreground">{item.name}</p>
              <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{item.purpose}</p>
            </div>
            <span className="text-xs text-muted-foreground">{item.platforms}</span>
          </a>
        ))}
      </div>

      <p className="mt-4 rounded-lg border border-border bg-muted px-3.5 py-2.5 text-sm leading-6 text-muted-foreground">
        sur.plus does not host installers. Download only from the official pages above and
        verify the checksums the vendors publish next to each release. The templates are
        starting points, not legal or tax advice.
      </p>
    </section>
  );
}

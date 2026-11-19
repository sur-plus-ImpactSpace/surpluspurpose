/**
 * Placeholder for the sur.plus AI assistant. The real LLM integration is
 * intentionally left out for now — this reserves the spot and shows what's
 * coming, with a disabled input so nothing looks broken or clickable.
 */
export function SurplusAssistant() {
  return (
    <section
      aria-label="sur.plus assistant (coming soon)"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-5 py-4">
        <div>
          <p
            className="text-xs font-medium"
          >
            Assistant
          </p>
          <h2 className="mt-1 text-xl font-semibold text-foreground">Ask sur.plus AI</h2>
        </div>
        <span className="inline-flex w-fit items-center whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
          Coming soon
        </span>
      </div>

      <div className="flex flex-col gap-2 px-5 py-5" aria-hidden>
        <div className="max-w-[85%] self-start rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm text-muted-foreground">
          Hi! Soon I&#39;ll help you get verified, understand which proof you need, and use your
          workspace.
        </div>
        <div className="max-w-[70%] self-end rounded-2xl rounded-br-md bg-border px-3.5 py-2 text-sm text-muted-foreground">
          What proof does a public school need?
        </div>
      </div>

      <div className="border-t border-border px-5 py-3.5">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-muted px-3.5 py-2.5">
          <span className="text-sm text-muted-foreground">The assistant will be available soon…</span>
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted-foreground/40 text-sm font-semibold text-background"
          >
            &#8594;
          </span>
        </div>
      </div>
    </section>
  );
}

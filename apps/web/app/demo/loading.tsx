/**
 * Loading state for the demo workspace (B3).
 *
 * The page is `force-dynamic`, so Next streams this while the server renders.
 * It deliberately mirrors the shell's silhouette — dark topbar, sidebar column,
 * header block, KPI row — so nothing jumps when the real content arrives.
 */
export default function DemoLoading() {
  return (
    <div aria-busy="true" className="min-h-screen bg-background">
      <span className="sr-only">Loading the demo workspace…</span>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-primary">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center px-4 sm:px-6">
          <span className=" text-[17px] leading-none text-white">sur.plus</span>
          <div className="ml-auto h-6 w-40 animate-pulse rounded-full bg-card/10" />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="sticky top-12 hidden h-[calc(100vh-3rem)] flex-col gap-2 border-r border-white/10 bg-primary px-2.5 py-4 lg:flex">
          <div className="mx-1.5 mb-3 h-9 w-9 animate-pulse rounded-full bg-card/10" />
          {[0, 1, 2, 3, 4].map((row) => (
            <div className="h-8 animate-pulse rounded-md bg-card/6" key={row} />
          ))}
        </aside>

        <main className="min-w-0">
          <div className="border-b border-border bg-card px-5 py-7 sm:px-8">
            <div className="h-3 w-48 animate-pulse rounded-sm bg-black/[0.07]" />
            <div className="mt-4 h-9 w-full max-w-xl animate-pulse rounded-sm bg-black/[0.07]" />
            <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-sm bg-muted" />
            <div className="mt-5 h-14 w-full max-w-3xl animate-pulse rounded-lg bg-muted" />
          </div>

          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
            <div className="grid gap-4 lg:grid-cols-4">
              {[0, 1, 2, 3].map((card) => (
                <div
                  className="rounded-xl border border-border bg-card p-4 shadow-xs"
                  key={card}
                >
                  <div className="h-2.5 w-20 animate-pulse rounded-sm bg-black/[0.07]" />
                  <div className="mt-3 h-7 w-16 animate-pulse rounded-sm bg-black/[0.07]" />
                </div>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              {[0, 1].map((panel) => (
                <div
                  className="rounded-xl border border-border bg-card p-5 shadow-xs"
                  key={panel}
                >
                  <div className="h-2.5 w-28 animate-pulse rounded-sm bg-black/[0.07]" />
                  <div className="mt-3 h-5 w-56 animate-pulse rounded-sm bg-black/[0.07]" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full animate-pulse rounded-sm bg-muted" />
                    <div className="h-3 w-5/6 animate-pulse rounded-sm bg-muted" />
                    <div className="h-3 w-2/3 animate-pulse rounded-sm bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

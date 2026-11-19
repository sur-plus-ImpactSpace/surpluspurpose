const EXAMPLES = [
  { from: "Office move · Munich", good: "200 desks", to: "School network · Warsaw" },
  { from: "IT refresh · Berlin", good: "320 laptops", to: "Youth NGO · Lisbon" },
  { from: "Overstock · Zurich", good: "8,000 garments", to: "Relief org · Lesbos" }
];

/**
 * An illustrative, static preview of how matching works, shown while a workspace
 * cannot match yet (an unverified NGO, or a corporate on the free plan). It is
 * explicitly labelled as an example — never real platform figures — so it stays
 * honest per the AGENTS claim rules.
 */
export function MatchingPrincipleDemo({
  perspective
}: {
  perspective: "ngo" | "corporate";
}) {
  const lead =
    perspective === "ngo"
      ? "Once you are verified, sur.plus matches verified corporate surplus to the needs you post — here is how it flows."
      : "Once your plan is active, sur.plus matches your surplus with verified NGOs — here is how it flows.";

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="border-b border-border bg-muted px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground">
          Example · how matching works
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">The matching principle</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{lead}</p>
      </div>

      <div className="grid gap-3 px-5 py-5 sm:grid-cols-3">
        {[
          { n: 1, t: "Corporate lists surplus", d: "Usable goods that would otherwise be wasted." },
          { n: 2, t: "sur.plus matches", d: "A verified NGO whose need fits the goods and place." },
          { n: 3, t: "Delivered + documented", d: "Goods and a donation certificate arrive together." }
        ].map((step) => (
          <div className="rounded-lg border border-border p-3.5" key={step.n}>
            <div
              className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
            >
              {step.n}
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{step.t}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.d}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-5 py-4">
        <p className="text-[0.7rem] font-medium text-muted-foreground">
          Illustrative example matches
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground" key={ex.good}>
              <span>{ex.from}</span>
              <span aria-hidden className="text-muted-foreground">→</span>
              <span className="font-semibold text-foreground">{ex.good}</span>
              <span aria-hidden className="text-muted-foreground">→</span>
              <span>{ex.to}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import type { Match, SurplusRepository } from "@surplus/domain";
import { ArrowUpRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { TrendChart } from "./Charts";
import { MatchStepper, matchStateLabel } from "./shared";

type Stat = { label: string; value: string };
type JourneyStep = { label: string; done: boolean };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STAGES: Array<{ label: string; states: Array<Match["state"]> }> = [
  { label: "Proposed", states: ["proposed", "ngo_confirmed"] },
  { label: "Confirmed", states: ["both_confirmed"] },
  { label: "In transit", states: ["in_transit"] },
  { label: "Done", states: ["delivered", "completed"] }
];

/** CO2e running total at the end of each month of `year`; null before the first match. */
function monthlySeries(matches: Match[], year: number): Array<number | null> {
  const sorted = [...matches].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return MONTHS.map((_, month) => {
    const upTo = sorted.filter((match) => {
      const created = new Date(match.createdAt);

      return created.getFullYear() < year || (created.getFullYear() === year && created.getMonth() <= month);
    });

    return upTo.length ? upTo.reduce((sum, match) => sum + match.co2Tons, 0) : null;
  });
}

function ImpactChart({ matches, year }: { matches: Match[]; year: number }) {
  const data = monthlySeries(matches, year).map((value, month) => ({ label: MONTHS[month] ?? "", co2: value === null ? 0 : Number(value.toFixed(2)) }));

  return <TrendChart config={{ co2: { label: "CO₂e (t)", color: "var(--chart-1)" } }} data={data} dataKey="co2" />;
}

/** Presentation over data the dashboards already load: nothing here writes or decides. */
export function OverviewBento({
  impactHref,
  journey,
  matches,
  repo,
  stats
}: {
  /** Where the arrow on the performance card goes; omitted for Ops. */
  impactHref?: string;
  /** The workspace's onboarding path (verify, list/post, match, deliver); omitted for Ops. */
  journey?: JourneyStep[];
  matches: Match[];
  repo: SurplusRepository;
  stats: Stat[];
}) {
  const co2 = matches.reduce((sum, match) => sum + match.co2Tons, 0);
  const units = matches.reduce((sum, match) => sum + match.quantity, 0);
  const score = matches.length ? Math.round(matches.reduce((sum, match) => sum + match.score, 0) / matches.length) : 0;
  const year = matches.length
    ? new Date([...matches].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!.createdAt).getFullYear()
    : new Date().getFullYear();
  const titleOf = (match: Match) => repo.listings.get(match.listingId)?.title ?? match.id;
  const stage = STAGES.map((item) => ({
    ...item,
    count: matches.filter((match) => item.states.includes(match.state)).length
  }));

  return (
    <div className="grid gap-4">
      {journey ? <JourneyStepper steps={journey} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.slice(0, 4).map((stat) => (
          <Card className="gap-1 py-4" key={stat.label}>
            <CardHeader className="pb-0">
              <CardDescription>{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="wrap-break-word text-2xl font-semibold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>CO₂e avoided</CardTitle>
            <CardDescription>
              {co2.toFixed(1)} t in {year} · {units} {units === 1 ? "unit" : "units"} moved
            </CardDescription>
            {impactHref ? (
              <CardAction>
                <a
                  aria-label="Open impact report"
                  className="flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  href={impactHref}
                >
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </a>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            <ImpactChart matches={matches} year={year} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Match score</CardTitle>
            <CardDescription>Average across your matches</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-5xl font-semibold tabular-nums tracking-tight">
              {score}
              <span className="ml-1 text-lg font-normal text-muted-foreground">/100</span>
            </p>
            <Progress value={score} />
            <div className="grid gap-2.5 pt-2">
              {stage.map((item) => (
                <div className="flex items-center justify-between text-sm" key={item.label}>
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium tabular-nums">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matches</CardTitle>
        </CardHeader>
        <CardContent>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matches yet. They appear here as soon as one is proposed.</p>
          ) : (
            <ul className="divide-y">
              {matches.map((match) => (
                <li className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-center" key={match.id}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{titleOf(match)}</span>
                    <span className="block text-xs text-muted-foreground">{matchStateLabel(match.state)}</span>
                  </span>
                  <MatchStepper compact state={match.state} />
                  <Badge variant="secondary">score {match.score}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Where the workspace is on its path: finished steps filled, the first open one ringed. */
function JourneyStepper({ steps }: { steps: JourneyStep[] }) {
  const next = steps.findIndex((step) => !step.done);

  return (
    <Card className="py-4">
      <CardContent>
        <ol aria-label="Getting started" className="flex items-start overflow-x-auto">
          {steps.map((step, index) => {
            const active = index === next;

            return (
              <li aria-current={active ? "step" : undefined} className="flex min-w-24 flex-1 flex-col items-center text-center" key={step.label}>
                <div className="flex w-full items-center">
                  <span className={cn("h-px flex-1", index === 0 ? "bg-transparent" : step.done || active ? "bg-primary" : "bg-border")} />
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      step.done ? "bg-primary text-primary-foreground" : active ? "border-2 border-primary bg-background text-primary" : "border bg-muted text-muted-foreground"
                    )}
                  >
                    {step.done ? <Check aria-hidden="true" className="size-3.5" /> : index + 1}
                  </span>
                  <span className={cn("h-px flex-1", index === steps.length - 1 ? "bg-transparent" : step.done ? "bg-primary" : "bg-border")} />
                </div>
                <span className={cn("mt-2 text-xs leading-tight", active ? "font-medium text-foreground" : "text-muted-foreground")}>{step.label}</span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

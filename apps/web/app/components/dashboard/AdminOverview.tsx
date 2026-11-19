import { BarsChart, DonutChart, TrendChart } from "./Charts";
import type { AccessRequest, Match, RepositoryData } from "@surplus/domain";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STAGES: Array<{ label: string; states: Array<Match["state"]> }> = [
  { label: "Proposed", states: ["proposed", "ngo_confirmed"] },
  { label: "Confirmed", states: ["both_confirmed"] },
  { label: "In transit", states: ["in_transit"] },
  { label: "Delivered", states: ["delivered", "completed"] }
];
const PLANS: Array<{ label: string; plans: string[] }> = [
  { label: "Registered", plans: ["registered"] },
  { label: "Seed", plans: ["seed"] },
  { label: "Tree", plans: ["tree"] }
];

const card = "rounded-xl border border-border bg-card p-5 shadow-xs";
const cardTitle = "text-sm font-medium text-muted-foreground";

/** Number card: links to the tab where the work is done. */
function Stat({ hint, href, label, value }: { hint: string; href: string; label: string; value: number }) {
  return (
    <a className={`${card} block transition-colors hover:border-primary`} href={href}>
      <p className={cardTitle}>{label}</p>
      <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </a>
  );
}

/** Matches created per month over the last twelve months. */
function MatchesPerMonth({ matches }: { matches: Match[] }) {
  const now = new Date();
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);

    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: MONTHS[date.getMonth()] ?? "" };
  });
  const counts = months.map(
    (month) =>
      matches.filter((match) => {
        const created = new Date(match.createdAt);

        return `${created.getFullYear()}-${created.getMonth()}` === month.key;
      }).length
  );
  const data = months.map((month, index) => ({ label: month.label, matches: counts[index] ?? 0 }));

  return (
    <section className={`${card} lg:col-span-2`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cardTitle}>Matches per month</h2>
        <p className="text-sm text-muted-foreground">{matches.length} in total</p>
      </div>
      <div className="mt-4">
        <TrendChart config={{ matches: { label: "Matches", color: "var(--chart-1)" } }} data={data} dataKey="matches" />
      </div>
    </section>
  );
}

/** A donut of how many NGOs are verified, waiting or otherwise. */
function NgoStatus({ ngos }: { ngos: RepositoryData["ngos"] }) {
  const verified = ngos.filter((ngo) => ngo.verificationState === "verified").length;

  return (
    <section className={card}>
      <h2 className={cardTitle}>NGO verification</h2>
      <div className="mt-4">
        <DonutChart
          slices={[
            { name: "Verified", value: verified },
            { name: "Waiting", value: ngos.length - verified }
          ]}
        />
      </div>
    </section>
  );
}

/** Horizontal bars with a count each. */
function BarsCard({ rows, title }: { rows: Array<{ count: number; label: string }>; title: string }) {
  return (
    <section className={card}>
      <h2 className={cardTitle}>{title}</h2>
      <div className="mt-4">
        <BarsChart rows={rows} />
      </div>
    </section>
  );
}

/** The newest access requests, as a small table. */
function LatestRequests({ requests }: { requests: AccessRequest[] }) {
  const latest = [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={`${cardTitle} `}>Latest requests</h2>
        <a className="text-xs font-semibold text-foreground underline-offset-2 hover:underline" href="/ops/requests">
          All
        </a>
      </div>
      {latest.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No requests yet.</p>
      ) : (
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 text-right font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {latest.map((request) => (
              <tr key={request.id}>
                <td className="max-w-[9rem] truncate py-2 pr-2 font-medium text-foreground" title={request.organization}>
                  {request.name}
                </td>
                <td className="py-2 pr-2 text-muted-foreground">{request.role === "ngo" ? "NGO" : "Corporate"}</td>
                <td className="py-2 text-right text-muted-foreground">{request.createdAt.slice(5, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * The admin overview: four number cards, then a three-column grid (one wide chart,
 * three small charts and one small table). Everything links to its tab.
 */
export function AdminOverview({
  data,
  logisticsPending,
  requests,
  unpaidCompanies,
  matches
}: {
  data: RepositoryData;
  logisticsPending: number;
  matches: Match[];
  requests: AccessRequest[];
  unpaidCompanies: number;
}) {
  const waitingNgos = data.ngos.filter((ngo) => ngo.verificationState !== "verified").length;

  return (
    <div className="mx-auto grid max-w-[1400px] gap-5 px-5 py-6 sm:px-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat hint="waiting for verification" href="/ops/ngos" label="NGOs" value={waitingNgos} />
        <Stat hint="without a plan" href="/ops/companies" label="Companies" value={unpaidCompanies} />
        <Stat hint="asked for access" href="/ops/requests" label="Requests" value={requests.length} />
        <Stat hint="need a step" href="/matches" label="Matches" value={logisticsPending} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <MatchesPerMonth matches={matches} />
        <NgoStatus ngos={data.ngos} />
        <BarsCard
          rows={STAGES.map((stage) => ({
            label: stage.label,
            count: matches.filter((match) => stage.states.includes(match.state)).length
          }))}
          title="Matches by stage"
        />
        <BarsCard
          rows={PLANS.map((plan) => ({
            label: plan.label,
            count: data.companies.filter((company) => plan.plans.includes(company.plan)).length
          }))}
          title="Companies by plan"
        />
        <LatestRequests requests={requests} />
      </div>
    </div>
  );
}

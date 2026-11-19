import { isPaidPlan, type ActorContext, type RepositoryData, type SurplusRepository } from "@surplus/domain";
import { nextMatchActionForRole } from "../match-actions";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";
import { AdminOverview } from "./AdminOverview";

/**
 * The authenticated Ops overview (`/`): four number cards and a few charts, all
 * linking to the tabs where the work happens (NGOs, Companies, Requests, Approvals,
 * Matches). The long panel scroll stays in AdminDashboard for the public /demo.
 */
export function AdminCockpit({
  actor,
  data,
  repo
}: {
  actor: Extract<ActorContext, { role: "admin" | "editor" }>;
  /** Kept so the page passes the same props to every cockpit; the overview needs no auth config. */
  authConfig?: SupabaseBrowserConfig | null;
  data: RepositoryData;
  repo: SurplusRepository;
}) {
  const matches = repo.matches.list(actor);
  // Companies that registered and never bought a plan: the upgrade list.
  const unpaidCompanies = data.companies.filter((company) => !isPaidPlan(company.plan));
  const logisticsPending = matches.filter((match) => nextMatchActionForRole(match.state, "admin") !== null).length;

  return (
    <AdminOverview
      data={data}
      logisticsPending={logisticsPending}
      matches={matches}
      requests={repo.accessRequests.list(actor)}
      unpaidCompanies={unpaidCompanies.length}
    />
  );
}

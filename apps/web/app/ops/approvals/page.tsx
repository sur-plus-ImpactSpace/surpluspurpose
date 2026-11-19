import { buildOpsRiskQueue } from "@surplus/domain";
import { DataTable, NameCell, StatusBadge } from "../../components/admin/DataTable";
import { DetailDialog, DetailGrid } from "../../components/admin/DetailDialog";
import { AdminPage } from "../../components/dashboard/AdminPage";
import type { SearchParams } from "../../lib/workspace-view";

export const dynamic = "force-dynamic";

/** Turns machine words like `data_wipe_documented` into `data wipe documented`. */
const readable = (text: string) => text.replace(/\b[a-z]+(?:_[a-z]+)+\b/g, (token) => token.replace(/_/g, " "));

const TONE = { high: "bad", medium: "warn", low: "neutral" } as const;

/** What waits on a human decision: agent actions, verifications, flagged listings. */
export default function OpsApprovalsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return (
    <AdminPage activeHref="/ops/approvals" searchParams={searchParams} title="Approvals">
      {({ data }) => {
        const items = buildOpsRiskQueue({
          proposedActions: data.proposedActions,
          agentRuns: data.agentRuns,
          ngos: data.ngos,
          listings: data.listings,
          companies: data.companies,
          companyChecks: data.companyChecks,
          schedulerJobRuns: data.schedulerJobRuns
        }).items;

        return (
          <DataTable
            columns={[{ label: "Risk" }, { label: "Item" }, { label: "Detail" }, { label: "", align: "right" }]}
            empty="Nothing waits on Ops."
            rows={items.map((item) => ({
              id: item.id,
              search: `${item.title} ${readable(item.detail)}`,
              status: String(item.riskLevel),
              cells: [
                <StatusBadge key="r" tone={TONE[item.riskLevel as keyof typeof TONE] ?? "neutral"}>{item.riskLevel}</StatusBadge>,
                <NameCell key="t" name={item.title} />,
                <p className="max-w-md truncate text-muted-foreground" key="d" title={readable(item.detail)}>
                  {readable(item.detail)}
                </p>,
                <DetailDialog key="v" title={item.title}>
                  <DetailGrid
                    items={[
                      { label: "Risk", value: item.riskLevel },
                      { label: "Detail", value: readable(item.detail) }
                    ]}
                  />
                </DetailDialog>
              ]
            }))}
            title="Risk queue"
          />
        );
      }}
    </AdminPage>
  );
}

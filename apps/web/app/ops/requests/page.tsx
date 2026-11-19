import { AccessRequestActions } from "../../components/admin/AccessRequestActions";
import { DataTable, NameCell, StatusBadge } from "../../components/admin/DataTable";
import { DetailDialog, DetailGrid } from "../../components/admin/DetailDialog";
import { AdminPage } from "../../components/dashboard/AdminPage";
import type { SearchParams } from "../../lib/workspace-view";

export const dynamic = "force-dynamic";

const STATUS_TONE = { new: "neutral", invited: "good", declined: "bad" } as const;

/** Leads from the public "Request access" form, newest first. */
export default function OpsRequestsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return (
    <AdminPage activeHref="/ops/requests" searchParams={searchParams} title="Access requests">
      {({ actor, authConfig, repo }) => {
        const requests = [...repo.accessRequests.list(actor)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

        return (
          <DataTable
            columns={[
              { label: "Name" },
              { label: "Type" },
              { label: "Email" },
              { label: "Status" },
              { label: "Date" },
              { label: "", align: "right" }
            ]}
            empty="Nobody has asked for access yet."
            rows={requests.map((request) => ({
              id: request.id,
              search: [request.name, request.organization, request.email].join(" "),
              status: request.status,
              cells: [
                <NameCell key="n" name={request.name} sub={request.organization} />,
                <StatusBadge key="t">{request.role === "ngo" ? "NGO" : "Corporate"}</StatusBadge>,
                <a className="font-semibold text-primary hover:underline" href={`mailto:${request.email}`} key="e">
                  {request.email}
                </a>,
                <StatusBadge key="s" tone={STATUS_TONE[request.status]}>{request.status}</StatusBadge>,
                <span className="text-muted-foreground" key="d">{request.createdAt.slice(0, 10)}</span>,
                <DetailDialog
                  footer={<AccessRequestActions config={authConfig} requestId={request.id} status={request.status} />}
                  key="v"
                  subtitle={request.organization}
                  title={request.name}
                >
                  <div className="grid gap-6">
                    <DetailGrid
                      items={[
                        { label: "Organisation", value: request.organization },
                        { label: "Type", value: request.role === "ngo" ? "NGO" : "Corporate" },
                        { label: "Email", value: request.email },
                        { label: "Phone", value: request.phone },
                        { label: "Status", value: request.status },
                        { label: "Received", value: request.createdAt.slice(0, 10) }
                      ]}
                    />
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Message</p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{request.message?.trim() || "—"}</p>
                    </div>
                  </div>
                </DetailDialog>
              ]
            }))}
            title="Access requests"
          />
        );
      }}
    </AdminPage>
  );
}

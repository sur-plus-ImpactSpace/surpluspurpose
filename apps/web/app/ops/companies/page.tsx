import { isOpsAdminRole, isPaidPlan } from "@surplus/domain";
import { DataTable, NameCell, StatusBadge } from "../../components/admin/DataTable";
import { DetailDialog, DetailGrid } from "../../components/admin/DetailDialog";
import { ProofThumb } from "../../components/admin/ProofThumb";
import { AdminPage } from "../../components/dashboard/AdminPage";
import { CompanyPlanControls } from "../../components/CompanyPlanControls";
import { CompanyVerificationControls } from "../../components/CompanyVerificationControls";
import { CompanyVerificationDocuments } from "../../components/CompanyVerificationDocuments";
import type { SearchParams } from "../../lib/workspace-view";

export const dynamic = "force-dynamic";

const joined = (iso: string) => {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Every company in one table, those without a plan first. Plan and verification are set in the dialog. */
export default function OpsCompaniesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return (
    <AdminPage activeHref="/ops/companies" searchParams={searchParams} title="Companies">
      {({ actor, authConfig, data, repo }) => {
        const companies = [...data.companies].sort(
          (a, b) => Number(isPaidPlan(a.plan)) - Number(isPaidPlan(b.plan)) || b.createdAt.localeCompare(a.createdAt)
        );

        return (
          <DataTable
            columns={[
              { label: "Company" },
              { label: "Plan" },
              { label: "Verification" },
              { label: "Proof" },
              { label: "Joined" },
              { label: "", align: "right" }
            ]}
            empty="No companies yet."
            rows={companies.map((company) => {
              const state = company.verificationState ?? "onboarding";
              const listings = repo.listings.listForCompany(company.id).length;
              const place = [company.city, company.country].filter(Boolean).join(", ");

              return {
                id: company.id,
                search: [company.name, company.contactEmail, place].filter(Boolean).join(" "),
                status: state.replace(/_/g, " "),
                cells: [
                  <NameCell key="n" name={company.name} sub={company.contactEmail || place} />,
                  <StatusBadge key="p" tone={isPaidPlan(company.plan) ? "good" : "neutral"}>{company.plan}</StatusBadge>,
                  <StatusBadge key="v" tone={state === "verified" ? "good" : state === "rejected" ? "bad" : "warn"}>
                    {state.replace(/_/g, " ")}
                  </StatusBadge>,
                  <ProofThumb id={company.id} key="pr" kind="companies" />,
                  <span className="text-muted-foreground" key="j">{joined(company.createdAt)}</span>,
                  <DetailDialog
                    footer={state === "verified" ? null : <CompanyVerificationControls companyId={company.id} />}
                    key="d"
                    subtitle={place}
                    title={company.name}
                  >
                    <div className="grid gap-6">
                      <DetailGrid
                        items={[
                          { label: "Contact", value: company.contactEmail },
                          { label: "Location", value: place },
                          { label: "Plan", value: company.plan },
                          { label: "Verification", value: state.replace(/_/g, " ") },
                          { label: "Listings", value: String(listings) },
                          { label: "Joined", value: joined(company.createdAt) }
                        ]}
                      />
                      {isOpsAdminRole(actor.role) ? (
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Plan</p>
                          <CompanyPlanControls
                            actorUserId={actor.userId}
                            authConfig={authConfig}
                            companyId={company.id}
                            plan={company.plan}
                          />
                        </div>
                      ) : null}
                      <CompanyVerificationDocuments companyId={company.id} />
                    </div>
                  </DetailDialog>
                ]
              };
            })}
            title="Companies"
          />
        );
      }}
    </AdminPage>
  );
}

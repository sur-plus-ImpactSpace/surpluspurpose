import { isNgoProofExpiringSoon, ngoRequiresProofExpiry } from "@surplus/domain";
import { DataTable, NameCell, StatusBadge } from "../../components/admin/DataTable";
import { DetailDialog, DetailGrid } from "../../components/admin/DetailDialog";
import { ProofThumb } from "../../components/admin/ProofThumb";
import { AdminPage } from "../../components/dashboard/AdminPage";
import { orgTypeLabel, signerLabel } from "../../components/dashboard/AdminDashboard";
import { NgoVerificationControls } from "../../components/NgoVerificationControls";
import { NgoVerificationDocuments } from "../../components/NgoVerificationDocuments";
import type { SearchParams } from "../../lib/workspace-view";

export const dynamic = "force-dynamic";

/** Every NGO in one table, those waiting for verification first. Details and the decision live in the dialog. */
export default function OpsNgosPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  return (
    <AdminPage activeHref="/ops/ngos" searchParams={searchParams} title="NGOs">
      {({ actor, authConfig, data }) => {
        const today = new Date().toISOString().slice(0, 10);
        const ngos = [...data.ngos].sort((a, b) => {
          const aExpiring = isNgoProofExpiringSoon(a) ? 0 : 1;
          const bExpiring = isNgoProofExpiringSoon(b) ? 0 : 1;
          if (aExpiring !== bExpiring) return aExpiring - bExpiring;
          return Number(a.verificationState === "verified") - Number(b.verificationState === "verified");
        });

        return (
          <DataTable
            columns={[
              { label: "NGO" },
              { label: "Type" },
              { label: "Contact" },
              { label: "Proof" },
              { label: "Validity" },
              { label: "Status" },
              { label: "", align: "right" }
            ]}
            empty="No NGOs yet."
            rows={ngos.map((ngo) => {
              const verified = ngo.verificationState === "verified";
              const place = [ngo.city, ngo.country].filter(Boolean).join(", ");
              const requiresExpiry = ngoRequiresProofExpiry(ngo.orgType);
              const expired =
                requiresExpiry &&
                Boolean(ngo.proofValidUntil) &&
                (ngo.proofValidUntil as string) < today &&
                ngo.verificationState !== "verified";
              const expiring = isNgoProofExpiringSoon(ngo);
              const validityLabel = !requiresExpiry
                ? "No notice expiry"
                : ngo.proofValidUntil
                  ? expiring
                    ? `Expires ${ngo.proofValidUntil}`
                    : expired
                      ? `Expired ${ngo.proofValidUntil}`
                      : `Until ${ngo.proofValidUntil}`
                  : "Not set";

              return {
                id: ngo.id,
                search: [ngo.name, ngo.contactEmail, place, ngo.focus, validityLabel]
                  .filter(Boolean)
                  .join(" "),
                status: verified ? "verified" : ngo.verificationState.replace(/_/g, " "),
                cells: [
                  <NameCell key="n" name={ngo.name} sub={[place, ngo.focus].filter(Boolean).join(" · ")} />,
                  orgTypeLabel(ngo.orgType) || "—",
                  <span className="text-muted-foreground" key="c">{ngo.contactEmail || "—"}</span>,
                  <ProofThumb id={ngo.id} key="p" kind="ngos" />,
                  <StatusBadge
                    key="v"
                    tone={expiring || expired ? "warn" : ngo.proofValidUntil ? "good" : "warn"}
                  >
                    {validityLabel}
                  </StatusBadge>,
                  <StatusBadge key="s" tone={verified ? "good" : ngo.verificationState === "rejected" ? "bad" : "warn"}>
                    {ngo.verificationState.replace(/_/g, " ")}
                  </StatusBadge>,
                  <DetailDialog
                    footer={
                      verified && !expiring ? null : (
                        <NgoVerificationControls
                          actorUserId={actor.userId}
                          authConfig={authConfig}
                          initialAssessmentPeriodYears={ngo.proofAssessmentPeriodYears ?? 5}
                          initialNoticeDate={ngo.proofNoticeDate ?? ngo.taxAuthorizationDate ?? ""}
                          ngoId={ngo.id}
                          requiresProofExpiry={requiresExpiry}
                        />
                      )
                    }
                    key="d"
                    subtitle={[place, ngo.focus].filter(Boolean).join(" · ")}
                    title={ngo.name}
                  >
                    <div className="grid gap-6">
                      <DetailGrid
                        items={[
                          { label: "Org type", value: orgTypeLabel(ngo.orgType) },
                          { label: "Registry no.", value: ngo.registryNumber },
                          { label: "Authorized signer", value: signerLabel(ngo) },
                          { label: "Contact", value: ngo.contactEmail },
                          { label: "Status", value: ngo.verificationState.replace(/_/g, " ") },
                          { label: "Notice date", value: ngo.proofNoticeDate },
                          {
                            label: "Assessment period",
                            value:
                              ngo.proofAssessmentPeriodYears != null
                                ? `${ngo.proofAssessmentPeriodYears} years`
                                : null
                          },
                          { label: "Proof valid until", value: ngo.proofValidUntil },
                          { label: "Trust score", value: `${ngo.trustScore}/100` }
                        ]}
                      />
                      <NgoVerificationDocuments ngoId={ngo.id} />
                    </div>
                  </DetailDialog>
                ]
              };
            })}
            title="NGOs"
          />
        );
      }}
    </AdminPage>
  );
}

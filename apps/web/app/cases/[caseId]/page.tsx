import {
  DONATION_CASE_STEP_BY_NUMBER,
  activeAllocatedQuantity,
  isCompanyVerified,
  isNgoVerified,
  isOpsRole,
  type DonationCaseStep
} from "@surplus/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageCrumb } from "../../components/PageCrumb";
import { DonationAllocationControls } from "../../components/DonationAllocationControls";
import { DonationCaseConfirmControls } from "../../components/DonationCaseConfirmControls";
import { DonationPositionControls } from "../../components/DonationPositionControls";
import { WORKSPACE_NAV, WorkspaceShell } from "../../components/shell/WorkspaceShell";
import { resolveWorkspaceForRoute, type SearchParams } from "../../lib/workspace-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "sur.plus · Donation case"
};

export default async function CaseDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { caseId } = await params;
  const { actor, authConfig, data, identity, locale, repo, t } =
    await resolveWorkspaceForRoute(searchParams);

  const donationCase = repo.donationCases.get(caseId);
  if (!donationCase) notFound();
  if (actor.role === "corporate" && donationCase.companyId !== actor.companyId) {
    notFound();
  }
  if (actor.role !== "corporate" && actor.role !== "admin" && actor.role !== "editor") {
    notFound();
  }

  const verified =
    actor.role === "corporate"
      ? isCompanyVerified(data.companies.find((company) => company.id === actor.companyId))
      : true;
  const positions = repo.donationPositions.listForCase(caseId);
  const allocations = repo.donationAllocations.listForCase(caseId);
  const stepKey = DONATION_CASE_STEP_BY_NUMBER[donationCase.step as DonationCaseStep];
  // Only Ops allocates (founder decision, ADR 0037); corporate sees claims read-only.
  const canAllocate = isOpsRole(actor.role);
  const ngoOptions = canAllocate
    ? repo.ngos
        .listForAdmin(actor)
        .filter((ngo) => isNgoVerified(ngo))
        .map((ngo) => ({ id: ngo.id, label: ngo.name }))
    : [];
  const positionOptions = positions
    .filter((position) => position.state === "confirmed" || position.state === "allocated")
    .map((position) => {
      const remaining = position.quantity - activeAllocatedQuantity(allocations, position.id);
      return {
        id: position.id,
        label: `${position.model} (${position.category})`,
        remaining
      };
    })
    .filter((option) => (option.remaining ?? 0) > 0);
  const allocationRows = allocations.map((allocation) => {
    const position = positions.find((item) => item.id === allocation.positionId);
    const ngo = data.ngos.find((item) => item.id === allocation.ngoId);
    return {
      ...allocation,
      positionLabel: position?.model ?? allocation.positionModel,
      // Corporate cannot read NGOs before a match (RLS) — no raw ids in the UI.
      ngoName: ngo?.name ?? "Verified organisation"
    };
  });

  return (
    <WorkspaceShell
      activeHref="/cases"
      activeRole={actor.role}
      authConfig={authConfig}
      identity={identity}
      locale={locale}
      nav={WORKSPACE_NAV[actor.role]}
      t={t}
      tag={t.workspaceTag}
    >
      <PageCrumb current={donationCase.title} />

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 sm:px-8">
        <header className="grid gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Step {donationCase.step}/7 · {stepKey}
            {donationCase.confirmedAt ? " · confirmed" : " · not confirmed"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {donationCase.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {donationCase.contactName} · {donationCase.contactEmail}
            {donationCase.contactPhone ? ` · ${donationCase.contactPhone}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {donationCase.city}, {donationCase.country}
            {donationCase.timeWindow ? ` · ${donationCase.timeWindow}` : ""}
            {donationCase.locationNotes ? ` · ${donationCase.locationNotes}` : ""}
          </p>
          <Link className="text-sm font-medium text-primary hover:underline" href="/cases">
            ← All cases
          </Link>
        </header>

        {!verified ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Browse only until Ops verifies your company — positions cannot be added yet.
          </p>
        ) : (
          <>
            <DonationCaseConfirmControls
              actorUserId={actor.userId}
              authConfig={authConfig}
              caseId={caseId}
              confirmedAt={donationCase.confirmedAt}
              positionCount={positions.length}
            />
            <DonationPositionControls
              actorUserId={actor.userId}
              authConfig={authConfig}
              caseId={caseId}
              positions={positions}
            />
            <DonationAllocationControls
              actorUserId={actor.userId}
              allocations={allocationRows}
              authConfig={authConfig}
              canAllocate={canAllocate}
              caseConfirmed={donationCase.confirmedAt !== null}
              caseId={caseId}
              ngoOptions={ngoOptions}
              positionOptions={positionOptions}
            />
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

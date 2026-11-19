import { buildImpactReport, isCompanyVerified, parseReportPeriod } from "@surplus/domain";
import { NextRequest, NextResponse } from "next/server";
import { enforceRouteRateLimit } from "../../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../../_lib/route-workspace";
import { renderCsrdReportCsv, renderCsrdReportHtml } from "./render-report";

export const dynamic = "force-dynamic";

/**
 * A company exports its complete CSRD/ESRS sustainability report for a chosen
 * period: ?from=YYYY-MM-DD&to=YYYY-MM-DD (either may be left out) and
 * &format=html (default, prints to PDF) or csv. Scoped to the caller's own
 * donations; documents are for verified companies only (ADR 0027).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const period = parseReportPeriod(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!period.ok) return routeJson({ error: period.reason }, 422);
  const format = url.searchParams.get("format") ?? "html";
  if (format !== "html" && format !== "csv") return routeJson({ error: "invalid_format" }, 422);

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, data, repository } = workspaceDecision.workspace;
  if (actor.role !== "corporate") return routeJson({ error: "actor_not_allowed" }, 403);
  const company = data.companies.find((item) => item.id === actor.companyId);
  if (!company) return routeJson({ error: "company_not_found" }, 404);
  if (!isCompanyVerified(company)) return routeJson({ error: "company_not_verified" }, 403);

  const rateLimit = await enforceRouteRateLimit({ actorId: actor.userId, endpointId: "reports.csrd", policy: "read" });
  if (rateLimit) return rateLimit;

  const report = buildImpactReport({
    matches: repository.matches.list(actor),
    listings: data.listings,
    needs: data.needs,
    ngos: data.ngos,
    period: period.period,
    co2Factors: data.co2Factors
  });
  const stamp = `${period.period?.from ?? "start"}_${period.period?.to ?? "today"}`;
  const body =
    format === "csv"
      ? renderCsrdReportCsv(report)
      : renderCsrdReportHtml(report, { companyName: company.name, generatedAt: new Date().toISOString() });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="sustainability-report_${stamp}.${format}"`,
      "Cache-Control": "no-store"
    }
  });
}

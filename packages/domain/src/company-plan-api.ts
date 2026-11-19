import { PLAN_TIERS, type PlanTier } from "./model";

export const COMPANY_PLAN_IDEMPOTENCY_HEADER = "idempotency-key";

export type CompanyPlanHeaderReader = {
  get(name: string): string | null;
};

export type CompanyPlanCommand = {
  idempotencyKey: string;
  companyId: string;
  plan: PlanTier;
};

export type CompanyPlanCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_company_id"
  | "invalid_payload"
  | "invalid_plan";

export type CompanyPlanCommandResult =
  | { ok: true; command: CompanyPlanCommand }
  | { ok: false; reason: CompanyPlanCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate a "move this company to that plan" request. Pure: no repository, no
 * authorization. The admin check lives in set_company_plan (0020) and in
 * repository.companies.setPlan — never here, so a caller cannot reach a plan
 * change by satisfying only this parser.
 */
export function parseCompanyPlanCommand(
  headers: CompanyPlanHeaderReader,
  companyId: unknown,
  body: unknown
): CompanyPlanCommandResult {
  const idempotencyKey = headers.get(COMPANY_PLAN_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof companyId !== "string" || !companyId.trim()) {
    return { ok: false, reason: "invalid_company_id", status: 422 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const plan = (body as Record<string, unknown>).plan;
  if (typeof plan !== "string" || !isPlanTier(plan)) {
    return { ok: false, reason: "invalid_plan", status: 422 };
  }

  return { ok: true, command: { idempotencyKey, companyId: companyId.trim(), plan } };
}

function isPlanTier(value: string): value is PlanTier {
  return (PLAN_TIERS as readonly string[]).includes(value);
}

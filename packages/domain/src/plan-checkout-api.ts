import { PAID_PLAN_TIERS, type PaidPlanTier } from "./model";

export type PlanCheckoutCommand = { idempotencyKey: string; companyId: string; plan: PaidPlanTier };

export type PlanCheckoutCommandResult =
  | { ok: true; command: PlanCheckoutCommand }
  | { ok: false; reason: "missing_idempotency_key" | "invalid_company_id" | "invalid_payload" | "invalid_plan"; status: 400 | 422 | 428 };

/**
 * Validate "buy this plan". Only Seed and Tree can be bought; Registered is the
 * free floor and NGOs never pay. Pure shape check: that the caller belongs to
 * the company and the plan is an upgrade is decided in the route.
 */
export function parsePlanCheckoutCommand(
  headers: { get(name: string): string | null },
  companyId: unknown,
  body: unknown
): PlanCheckoutCommandResult {
  const idempotencyKey = headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return { ok: false, reason: "missing_idempotency_key", status: 428 };
  if (typeof companyId !== "string" || !companyId.trim()) return { ok: false, reason: "invalid_company_id", status: 422 };
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, reason: "invalid_payload", status: 400 };

  const plan = (body as Record<string, unknown>).plan;
  if (typeof plan !== "string" || !(PAID_PLAN_TIERS as readonly string[]).includes(plan)) {
    return { ok: false, reason: "invalid_plan", status: 422 };
  }

  return { ok: true, command: { idempotencyKey, companyId: companyId.trim(), plan: plan as PaidPlanTier } };
}

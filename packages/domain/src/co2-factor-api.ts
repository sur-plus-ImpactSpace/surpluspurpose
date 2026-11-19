import { CO2_FACTOR_MAX } from "./model";

export type Co2FactorCommand = { idempotencyKey: string; category: string; kgCo2ePerKg: number };

export type Co2FactorCommandResult =
  | { ok: true; command: Co2FactorCommand }
  | { ok: false; reason: "missing_idempotency_key" | "invalid_payload" | "invalid_category" | "invalid_factor"; status: 400 | 422 | 428 };

/** Shape check for "set this category's CO2 factor". The admin guard lives in the repository and set_co2_factor. */
export function parseCo2FactorCommand(headers: { get(name: string): string | null }, body: unknown): Co2FactorCommandResult {
  const idempotencyKey = headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return { ok: false, reason: "missing_idempotency_key", status: 428 };
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, reason: "invalid_payload", status: 400 };

  const { category, kgCo2ePerKg } = body as Record<string, unknown>;
  const name = typeof category === "string" ? category.trim() : "";
  if (!name || name.length > 120) return { ok: false, reason: "invalid_category", status: 422 };
  if (typeof kgCo2ePerKg !== "number" || !Number.isFinite(kgCo2ePerKg) || kgCo2ePerKg < 0 || kgCo2ePerKg > CO2_FACTOR_MAX) {
    return { ok: false, reason: "invalid_factor", status: 422 };
  }

  return { ok: true, command: { idempotencyKey, category: name, kgCo2ePerKg } };
}

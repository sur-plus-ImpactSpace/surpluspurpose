import type { ListingCreateInput } from "./repository";

export const LISTING_IDEMPOTENCY_HEADER = "idempotency-key";

export type ListingHeaderReader = {
  get(name: string): string | null;
};

export type ListingCommand = {
  idempotencyKey: string;
  input: ListingCreateInput;
};

export type ListingCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_title"
  | "invalid_category"
  | "invalid_quantity"
  | "invalid_unit_value"
  | "invalid_location"
  | "invalid_condition"
  | "invalid_eligibility";

export type ListingCommandResult =
  | { ok: true; command: ListingCommand }
  | { ok: false; reason: ListingCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate the shape of a "create surplus listing" request. Pure: no repository,
 * no authorization. Business rules (actor allowed, eligibility all confirmed,
 * company resolution) stay in repository.listings.create.
 */
export function parseListingCommand(
  headers: ListingHeaderReader,
  body: unknown
): ListingCommandResult {
  const idempotencyKey = headers.get(LISTING_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }
  const record = body as Record<string, unknown>;

  const title = str(record.title)?.trim();
  if (!title) return { ok: false, reason: "invalid_title", status: 422 };

  const category = str(record.category)?.trim();
  if (!category) return { ok: false, reason: "invalid_category", status: 422 };

  const quantity = num(record.quantity);
  if (quantity === undefined || quantity <= 0) {
    return { ok: false, reason: "invalid_quantity", status: 422 };
  }

  const unitValue = num(record.unitValue);
  if (unitValue === undefined || unitValue < 0) {
    return { ok: false, reason: "invalid_unit_value", status: 422 };
  }

  const city = str(record.city)?.trim();
  const country = str(record.country)?.trim();
  if (!city || !country) {
    return { ok: false, reason: "invalid_location", status: 422 };
  }

  const condition = str(record.condition)?.trim();
  if (!condition) return { ok: false, reason: "invalid_condition", status: 422 };

  const eligibility = record.eligibility;
  if (typeof eligibility !== "object" || eligibility === null || Array.isArray(eligibility)) {
    return { ok: false, reason: "invalid_eligibility", status: 422 };
  }
  const elig = eligibility as Record<string, unknown>;
  if (
    typeof elig.usable !== "boolean" ||
    typeof elig.policyFit !== "boolean" ||
    typeof elig.ownership !== "boolean"
  ) {
    return { ok: false, reason: "invalid_eligibility", status: 422 };
  }

  const input: ListingCreateInput = {
    title,
    category,
    quantity,
    unitValue,
    city,
    country,
    condition,
    subcategory: str(record.subcategory)?.trim() || null,
    unit: str(record.unit)?.trim() || undefined,
    availableUntil: str(record.availableUntil) || null,
    pickupWindow: str(record.pickupWindow)?.trim() || undefined,
    packaging: str(record.packaging)?.trim() || undefined,
    weightKg: num(record.weightKg),
    categoryDetails: str(record.categoryDetails)?.trim() || undefined,
    eligibility: {
      usable: elig.usable,
      policyFit: elig.policyFit,
      ownership: elig.ownership
    }
  };

  return { ok: true, command: { idempotencyKey, input } };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

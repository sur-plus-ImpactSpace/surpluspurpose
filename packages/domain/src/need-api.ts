import {
  NEED_DELIVERY_PREFERENCES,
  NEED_URGENCIES,
  type NeedDeliveryPreference,
  type NeedUrgency
} from "./model";
import type { NeedCreateInput } from "./repository";

export const NEED_IDEMPOTENCY_HEADER = "idempotency-key";

export type NeedHeaderReader = {
  get(name: string): string | null;
};

export type NeedCommand = {
  idempotencyKey: string;
  input: NeedCreateInput;
};

export type NeedCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_title"
  | "invalid_category"
  | "invalid_quantity"
  | "invalid_urgency"
  | "invalid_target_date"
  | "invalid_location"
  | "invalid_beneficiaries"
  | "invalid_story"
  | "invalid_delivery_preference"
  | "invalid_max_quantity_per_match"
  | "invalid_target_group"
  | "invalid_delivery_address";

export type NeedCommandResult =
  | { ok: true; command: NeedCommand }
  | { ok: false; reason: NeedCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate the shape of a "post NGO need" request. Pure: no repository,
 * no authorization. Business rules (actor allowed, NGO resolution) stay
 * in repository.needs.create.
 */
export function parseNeedCommand(headers: NeedHeaderReader, body: unknown): NeedCommandResult {
  const idempotencyKey = headers.get(NEED_IDEMPOTENCY_HEADER)?.trim();
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

  // Optional at this boundary (kept lenient like the rest of parseNeedCommand);
  // the need form makes it required in the UI. Trimmed, empty becomes absent.
  const subcategory = str(record.subcategory)?.trim() || undefined;

  // Quantity is optional on purpose. Measured against the eight real Tally
  // submissions, requiring a number > 0 would have rejected five of them:
  // "3-5 Business-Laptops", "Laptop", "Holz / Baumaterial", "Laptops"
  // (unlimited), "30+". A number is still validated when one is given.
  const quantity = num(record.quantity);
  if (record.quantity !== undefined && record.quantity !== null && (quantity === undefined || quantity <= 0)) {
    return { ok: false, reason: "invalid_quantity", status: 422 };
  }

  const urgency = str(record.urgency)?.trim() || "flexible";
  if (!isNeedUrgency(urgency)) {
    return { ok: false, reason: "invalid_urgency", status: 422 };
  }

  const targetDate = str(record.targetDate)?.trim() || null;
  // A date only means anything for by_date; anywhere else it is noise that
  // would later be rendered as a commitment nobody made.
  if (urgency === "by_date" && !targetDate) {
    return { ok: false, reason: "invalid_target_date", status: 422 };
  }

  const city = str(record.city)?.trim();
  const country = str(record.country)?.trim();
  if (!city || !country) {
    return { ok: false, reason: "invalid_location", status: 422 };
  }

  const beneficiaries = num(record.beneficiaries);
  if (record.beneficiaries !== undefined && (beneficiaries === undefined || beneficiaries < 0)) {
    return { ok: false, reason: "invalid_beneficiaries", status: 422 };
  }

  // The story is required. In the real submissions it is the only field that
  // makes a corporate care — Save Ukraine explains 300 refugees a year, Kick
  // ins Leben names children aged 13 to 16 — and it is what the impact and
  // CSRD narrative is later built from. A word floor, not a character one:
  // characters invite padding, words ask for a sentence. BBW's entire entry
  // was "Für Azubis", which is exactly what this is meant to catch.
  const story = str(record.story)?.trim();
  if (!story || countWords(story) < STORY_MIN_WORDS) {
    return { ok: false, reason: "invalid_story", status: 422 };
  }

  const deliveryPreferenceRaw = str(record.deliveryPreference)?.trim() || "either";
  if (!isNeedDeliveryPreference(deliveryPreferenceRaw)) {
    return { ok: false, reason: "invalid_delivery_preference", status: 422 };
  }
  const deliveryPreference: NeedDeliveryPreference = deliveryPreferenceRaw;

  let maxQuantityPerMatch: number | null | undefined;
  if (record.maxQuantityPerMatch === undefined || record.maxQuantityPerMatch === null) {
    maxQuantityPerMatch = record.maxQuantityPerMatch === null ? null : undefined;
  } else {
    const capped = num(record.maxQuantityPerMatch);
    if (capped === undefined || !Number.isInteger(capped) || capped <= 0) {
      return { ok: false, reason: "invalid_max_quantity_per_match", status: 422 };
    }
    maxQuantityPerMatch = capped;
  }

  const targetGroup = str(record.targetGroup)?.trim();
  if (!targetGroup) {
    return { ok: false, reason: "invalid_target_group", status: 422 };
  }

  const deliveryAddress = str(record.deliveryAddress)?.trim();
  if (!deliveryAddress) {
    return { ok: false, reason: "invalid_delivery_address", status: 422 };
  }

  const hasVehicle = record.hasVehicle === true;

  const input: NeedCreateInput = {
    title,
    category,
    subcategory,
    quantity,
    quantityOpen: record.quantityOpen === true,
    urgency,
    city,
    country,
    targetDate: urgency === "by_date" ? targetDate : null,
    beneficiaries,
    story,
    deliveryPreference,
    maxQuantityPerMatch,
    targetGroup,
    deliveryAddress,
    hasVehicle
  };

  return { ok: true, command: { idempotencyKey, input } };
}

/** Minimum words in a need's story. Ten is roughly one honest sentence. */
export const STORY_MIN_WORDS = 10;

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function isNeedUrgency(value: string): value is NeedUrgency {
  return (NEED_URGENCIES as readonly string[]).includes(value);
}

function isNeedDeliveryPreference(value: string): value is NeedDeliveryPreference {
  return (NEED_DELIVERY_PREFERENCES as readonly string[]).includes(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

import type { DonationCaseCreateInput, DonationPositionCreateInput } from "./repository";

export const DONATION_CASE_IDEMPOTENCY_HEADER = "idempotency-key";

export type DonationCaseHeaderReader = {
  get(name: string): string | null;
};

export type DonationCaseCommand = {
  idempotencyKey: string;
  input: DonationCaseCreateInput;
};

export type DonationCaseCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_title"
  | "invalid_contact"
  | "invalid_location";

export type DonationCaseCommandResult =
  | { ok: true; command: DonationCaseCommand }
  | { ok: false; reason: DonationCaseCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate the shape of a "create donation case" request. Pure: no repository,
 * no authorization. Business rules stay in repository.donationCases.create.
 */
export function parseDonationCaseCommand(
  headers: DonationCaseHeaderReader,
  body: unknown
): DonationCaseCommandResult {
  const idempotencyKey = headers.get(DONATION_CASE_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }
  const record = body as Record<string, unknown>;

  const title = str(record.title)?.trim();
  if (!title) return { ok: false, reason: "invalid_title", status: 422 };

  const contactName = str(record.contactName)?.trim();
  const contactEmail = str(record.contactEmail)?.trim();
  if (!contactName || !contactEmail || !contactEmail.includes("@")) {
    return { ok: false, reason: "invalid_contact", status: 422 };
  }

  const city = str(record.city)?.trim();
  const country = str(record.country)?.trim();
  if (!city || !country) {
    return { ok: false, reason: "invalid_location", status: 422 };
  }

  const input: DonationCaseCreateInput = {
    title,
    contactName,
    contactEmail,
    contactPhone: str(record.contactPhone)?.trim() || null,
    city,
    country,
    locationNotes: str(record.locationNotes)?.trim() || null,
    timeWindow: str(record.timeWindow)?.trim() || null,
    availableFrom: str(record.availableFrom) || null,
    availableUntil: str(record.availableUntil) || null,
    companyId: str(record.companyId)?.trim() || undefined
  };

  return { ok: true, command: { idempotencyKey, input } };
}

export type DonationPositionCommand = {
  idempotencyKey: string;
  caseId: string;
  input: DonationPositionCreateInput;
};

export type DonationPositionCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_case_id"
  | "invalid_category"
  | "invalid_model"
  | "invalid_quantity"
  | "invalid_condition"
  | "invalid_provenance";

export type DonationPositionCommandResult =
  | { ok: true; command: DonationPositionCommand }
  | { ok: false; reason: DonationPositionCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate the shape of an "add position to case" request.
 */
export function parseDonationPositionCommand(
  headers: DonationCaseHeaderReader,
  caseId: string,
  body: unknown
): DonationPositionCommandResult {
  const idempotencyKey = headers.get(DONATION_CASE_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  const trimmedCaseId = caseId.trim();
  if (!trimmedCaseId) {
    return { ok: false, reason: "invalid_case_id", status: 422 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }
  const record = body as Record<string, unknown>;
  const parsed = parsePositionFields(record);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    command: { idempotencyKey, caseId: trimmedCaseId, input: parsed.input }
  };
}

export type DonationPositionImportCommand = {
  idempotencyKey: string;
  caseId: string;
  positions: DonationPositionCreateInput[];
};

export type DonationPositionImportCommandErrorReason =
  | DonationPositionCommandErrorReason
  | "empty_positions"
  | "too_many_positions";

export type DonationPositionImportCommandResult =
  | { ok: true; command: DonationPositionImportCommand }
  | { ok: false; reason: DonationPositionImportCommandErrorReason; status: 400 | 422 | 428 };

const MAX_IMPORT_POSITIONS = 500;

/**
 * Validate a batch import of positions (CSV/Excel mapped rows).
 */
export function parseDonationPositionImportCommand(
  headers: DonationCaseHeaderReader,
  caseId: string,
  body: unknown
): DonationPositionImportCommandResult {
  const idempotencyKey = headers.get(DONATION_CASE_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  const trimmedCaseId = caseId.trim();
  if (!trimmedCaseId) {
    return { ok: false, reason: "invalid_case_id", status: 422 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }
  const record = body as Record<string, unknown>;
  const rawPositions = record.positions;
  if (!Array.isArray(rawPositions)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }
  if (rawPositions.length === 0) {
    return { ok: false, reason: "empty_positions", status: 422 };
  }
  if (rawPositions.length > MAX_IMPORT_POSITIONS) {
    return { ok: false, reason: "too_many_positions", status: 422 };
  }

  const positions: DonationPositionCreateInput[] = [];
  for (const item of rawPositions) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { ok: false, reason: "invalid_payload", status: 400 };
    }
    const parsed = parsePositionFields(item as Record<string, unknown>);
    if (!parsed.ok) return parsed;
    positions.push(parsed.input);
  }

  return {
    ok: true,
    command: { idempotencyKey, caseId: trimmedCaseId, positions }
  };
}

function parsePositionFields(
  record: Record<string, unknown>
):
  | { ok: true; input: DonationPositionCreateInput }
  | { ok: false; reason: DonationPositionCommandErrorReason; status: 400 | 422 | 428 } {
  const category = str(record.category)?.trim();
  if (!category) return { ok: false, reason: "invalid_category", status: 422 };

  const model = str(record.model)?.trim();
  if (!model) return { ok: false, reason: "invalid_model", status: 422 };

  const quantity = num(record.quantity);
  if (quantity === undefined || quantity <= 0 || !Number.isInteger(quantity)) {
    return { ok: false, reason: "invalid_quantity", status: 422 };
  }

  const condition = str(record.condition)?.trim();
  if (!condition) return { ok: false, reason: "invalid_condition", status: 422 };

  const provenance = str(record.provenance)?.trim();
  if (!provenance) return { ok: false, reason: "invalid_provenance", status: 422 };

  return {
    ok: true,
    input: { category, model, quantity, condition, provenance }
  };
}

export type DonationCaseConfirmCommand = {
  idempotencyKey: string;
  caseId: string;
};

export type DonationCaseConfirmCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_case_id";

export type DonationCaseConfirmCommandResult =
  | { ok: true; command: DonationCaseConfirmCommand }
  | { ok: false; reason: DonationCaseConfirmCommandErrorReason; status: 422 | 428 };

/**
 * Validate the shape of a "confirm donation case inventory" request (REQ-CORP-02).
 */
export function parseDonationCaseConfirmCommand(
  headers: DonationCaseHeaderReader,
  caseId: string
): DonationCaseConfirmCommandResult {
  const idempotencyKey = headers.get(DONATION_CASE_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  const trimmedCaseId = caseId.trim();
  if (!trimmedCaseId) {
    return { ok: false, reason: "invalid_case_id", status: 422 };
  }

  return { ok: true, command: { idempotencyKey, caseId: trimmedCaseId } };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

import type { DonationAllocationCreateInput, DonationAllocationReleaseInput } from "./repository";

export const DONATION_ALLOCATION_IDEMPOTENCY_HEADER = "idempotency-key";

export type DonationAllocationHeaderReader = {
  get(name: string): string | null;
};

export type DonationAllocationCreateCommand = {
  idempotencyKey: string;
  caseId: string;
  input: DonationAllocationCreateInput;
};

export type DonationAllocationCreateCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_case_id"
  | "invalid_position_id"
  | "invalid_ngo_id"
  | "invalid_quantity";

export type DonationAllocationCreateCommandResult =
  | { ok: true; command: DonationAllocationCreateCommand }
  | { ok: false; reason: DonationAllocationCreateCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate the shape of a "create donation allocation" request (REQ-MATCH-09).
 * Business rules (confirm gate, qty cap) live in the repository / RPC.
 */
export function parseDonationAllocationCreateCommand(
  headers: DonationAllocationHeaderReader,
  caseId: string,
  body: unknown
): DonationAllocationCreateCommandResult {
  const idempotencyKey = headers.get(DONATION_ALLOCATION_IDEMPOTENCY_HEADER)?.trim();
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

  const positionId = str(record.positionId)?.trim();
  if (!positionId) return { ok: false, reason: "invalid_position_id", status: 422 };

  const ngoId = str(record.ngoId)?.trim();
  if (!ngoId) return { ok: false, reason: "invalid_ngo_id", status: 422 };

  const quantity = num(record.quantity);
  if (quantity === undefined || quantity <= 0 || !Number.isInteger(quantity)) {
    return { ok: false, reason: "invalid_quantity", status: 422 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      caseId: trimmedCaseId,
      input: { positionId, ngoId, quantity }
    }
  };
}

export type DonationAllocationReleaseCommand = {
  idempotencyKey: string;
  allocationId: string;
  input: DonationAllocationReleaseInput;
};

export type DonationAllocationReleaseCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_allocation_id"
  | "invalid_release_note";

export type DonationAllocationReleaseCommandResult =
  | { ok: true; command: DonationAllocationReleaseCommand }
  | { ok: false; reason: DonationAllocationReleaseCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate the shape of an NGO written release of claim (REQ-MATCH-09).
 */
export function parseDonationAllocationReleaseCommand(
  headers: DonationAllocationHeaderReader,
  allocationId: string,
  body: unknown
): DonationAllocationReleaseCommandResult {
  const idempotencyKey = headers.get(DONATION_ALLOCATION_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  const trimmedId = allocationId.trim();
  if (!trimmedId) {
    return { ok: false, reason: "invalid_allocation_id", status: 422 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }
  const record = body as Record<string, unknown>;
  const releaseNote = str(record.releaseNote)?.trim();
  if (!releaseNote) {
    return { ok: false, reason: "invalid_release_note", status: 422 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      allocationId: trimmedId,
      input: { releaseNote }
    }
  };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

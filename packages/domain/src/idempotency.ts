export type IdempotencyHashInput = {
  actorId: string;
  endpointId: string;
  body: unknown;
};

export const IDEMPOTENCY_RESERVATION_STATES = [
  "reserved",
  "replay",
  "processing",
  "failed",
  "conflict"
] as const;

export type IdempotencyReservationState = (typeof IDEMPOTENCY_RESERVATION_STATES)[number];

export type IdempotencyCacheEntry = {
  requestHash: string;
  status: "processing" | "completed" | "failed";
  responseStatus: number | null;
  responseBody: unknown;
  resourceType: string | null;
  resourceId: string | null;
};

export type IdempotencyReservation =
  | { state: "reserved" }
  | {
      state: "replay";
      responseStatus: number;
      responseBody: unknown;
      resourceType: string | null;
      resourceId: string | null;
    }
  | { state: "processing" | "failed" | "conflict" };

export type IdempotencyFailureReason =
  | "idempotency_key_processing"
  | "idempotency_key_failed"
  | "idempotency_key_conflict";

export type IdempotencyFailureHttp = {
  reason: IdempotencyFailureReason;
  status: 409;
};

export async function createIdempotencyRequestHash(input: IdempotencyHashInput): Promise<string> {
  const canonical = stableJson({
    actorId: input.actorId,
    endpointId: input.endpointId,
    body: input.body
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`);

  return `{${entries.join(",")}}`;
}

export function createScopedIdempotencyKey(input: {
  actorId: string;
  endpointId: string;
  idempotencyKey: string;
}): string {
  return `${input.actorId}:${input.endpointId}:${input.idempotencyKey}`;
}

export function isIdempotencyReservationState(value: unknown): value is IdempotencyReservationState {
  return (
    typeof value === "string" &&
    IDEMPOTENCY_RESERVATION_STATES.includes(value as IdempotencyReservationState)
  );
}

export function reserveLocalIdempotency(
  store: Map<string, IdempotencyCacheEntry>,
  input: {
    actorId: string;
    endpointId: string;
    idempotencyKey: string;
    requestHash: string;
  }
): IdempotencyReservation {
  const scopedKey = createScopedIdempotencyKey(input);
  const existing = store.get(scopedKey);

  if (!existing) {
    store.set(scopedKey, {
      requestHash: input.requestHash,
      status: "processing",
      responseStatus: null,
      responseBody: null,
      resourceType: null,
      resourceId: null
    });

    return { state: "reserved" };
  }

  if (existing.requestHash !== input.requestHash) return { state: "conflict" };
  if (existing.status === "processing") return { state: "processing" };
  if (existing.status === "failed") return { state: "failed" };

  if (existing.responseStatus === null || existing.responseBody === null) {
    return { state: "failed" };
  }

  return {
    state: "replay",
    responseStatus: existing.responseStatus,
    responseBody: existing.responseBody,
    resourceType: existing.resourceType,
    resourceId: existing.resourceId
  };
}

export function completeLocalIdempotency(
  store: Map<string, IdempotencyCacheEntry>,
  input: {
    actorId: string;
    endpointId: string;
    idempotencyKey: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    resourceType?: string | null;
    resourceId?: string | null;
  }
): boolean {
  const scopedKey = createScopedIdempotencyKey(input);
  const existing = store.get(scopedKey);
  if (!existing || existing.requestHash !== input.requestHash || existing.status !== "processing") {
    return false;
  }

  store.set(scopedKey, {
    requestHash: input.requestHash,
    status: "completed",
    responseStatus: input.responseStatus,
    responseBody: input.responseBody,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null
  });

  return true;
}

export function failLocalIdempotency(
  store: Map<string, IdempotencyCacheEntry>,
  input: {
    actorId: string;
    endpointId: string;
    idempotencyKey: string;
    requestHash: string;
  }
): boolean {
  const scopedKey = createScopedIdempotencyKey(input);
  const existing = store.get(scopedKey);
  if (!existing || existing.requestHash !== input.requestHash || existing.status !== "processing") {
    return false;
  }

  store.set(scopedKey, {
    ...existing,
    status: "failed"
  });

  return true;
}

export function idempotencyFailureHttp(
  state: Exclude<IdempotencyReservationState, "reserved" | "replay">
): IdempotencyFailureHttp {
  if (state === "conflict") return { reason: "idempotency_key_conflict", status: 409 };
  if (state === "failed") return { reason: "idempotency_key_failed", status: 409 };

  return { reason: "idempotency_key_processing", status: 409 };
}

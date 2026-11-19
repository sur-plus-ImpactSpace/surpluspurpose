import {
  completeLocalIdempotency,
  createIdempotencyRequestHash,
  failLocalIdempotency,
  idempotencyFailureHttp,
  isIdempotencyReservationState,
  reserveLocalIdempotency,
  type IdempotencyCacheEntry,
  type IdempotencyReservation
} from "@surplus/domain";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type RouteIdempotencyInput = {
  request: NextRequest;
  actorId: string;
  endpointId: string;
  idempotencyKey: string;
  body: unknown;
};

type CompleteIdempotencyInput = {
  responseStatus: number;
  responseBody: unknown;
  resourceType?: string | null;
  resourceId?: string | null;
};

type RouteIdempotencyDecision =
  | {
      kind: "execute";
      persistent: boolean;
      complete(input: CompleteIdempotencyInput): Promise<boolean>;
      fail(): Promise<boolean>;
    }
  | { kind: "response"; response: NextResponse };

type SupabaseIdempotencyConfig = {
  url: string;
  anonKey: string;
  authorization: string;
};

const previewIdempotencyStore = new Map<string, IdempotencyCacheEntry>();

export async function reserveRouteIdempotency(
  input: RouteIdempotencyInput
): Promise<RouteIdempotencyDecision> {
  const requestHash = await createIdempotencyRequestHash({
    actorId: input.actorId,
    endpointId: input.endpointId,
    body: input.body
  });
  const persistentConfig = getSupabaseIdempotencyConfig(input.request);

  if (persistentConfig.enabled && !persistentConfig.config) {
    return {
      kind: "response",
      response: json({ error: persistentConfig.reason }, persistentConfig.status)
    };
  }

  if (persistentConfig.config) {
    const reservation = await reservePersistentIdempotency(persistentConfig.config, {
      endpointId: input.endpointId,
      idempotencyKey: input.idempotencyKey,
      requestHash
    });

    if (!reservation.ok) {
      return {
        kind: "response",
        response: json({ error: "idempotency_unavailable" }, 503)
      };
    }

    if (reservation.value.state !== "reserved") {
      return {
        kind: "response",
        response: responseFromReservation(reservation.value)
      };
    }

    return {
      kind: "execute",
      persistent: true,
      complete: (completeInput) =>
        completePersistentIdempotency(persistentConfig.config, {
          endpointId: input.endpointId,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          ...completeInput
        }),
      fail: async () => false
    };
  }

  const localReservation = reserveLocalIdempotency(previewIdempotencyStore, {
    actorId: input.actorId,
    endpointId: input.endpointId,
    idempotencyKey: input.idempotencyKey,
    requestHash
  });

  if (localReservation.state !== "reserved") {
    return {
      kind: "response",
      response: responseFromReservation(localReservation)
    };
  }

  return {
    kind: "execute",
    persistent: false,
    complete: async (completeInput) =>
      completeLocalIdempotency(previewIdempotencyStore, {
        actorId: input.actorId,
        endpointId: input.endpointId,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        ...completeInput
      }),
    fail: async () =>
      failLocalIdempotency(previewIdempotencyStore, {
        actorId: input.actorId,
        endpointId: input.endpointId,
        idempotencyKey: input.idempotencyKey,
        requestHash
      })
  };
}

function responseFromReservation(reservation: Exclude<IdempotencyReservation, { state: "reserved" }>) {
  if (reservation.state === "replay") {
    return json(reservation.responseBody, reservation.responseStatus, {
      "X-Surplus-Idempotent-Replay": "true"
    });
  }

  const failure = idempotencyFailureHttp(reservation.state);
  const headers = reservation.state === "processing" ? { "Retry-After": "2" } : undefined;

  return json({ error: failure.reason }, failure.status, headers);
}

function getSupabaseIdempotencyConfig(
  request: NextRequest
):
  | { enabled: false; config: null }
  | { enabled: true; config: SupabaseIdempotencyConfig }
  | { enabled: true; config: null; reason: string; status: 401 | 503 } {
  if (process.env.SURPLUS_PERSISTENT_IDEMPOTENCY !== "true" && process.env.SURPLUS_ROUTE_RUNTIME !== "supabase") {
    return { enabled: false, config: null };
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !anonKey) {
    return { enabled: true, config: null, reason: "idempotency_not_configured", status: 503 };
  }
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return { enabled: true, config: null, reason: "auth_required", status: 401 };
  }

  return {
    enabled: true,
    config: {
      url: normalizeSupabaseUrl(url),
      anonKey,
      authorization
    }
  };
}

async function reservePersistentIdempotency(
  config: SupabaseIdempotencyConfig,
  input: {
    endpointId: string;
    idempotencyKey: string;
    requestHash: string;
  }
): Promise<{ ok: true; value: IdempotencyReservation } | { ok: false }> {
  const rpc = await callSupabaseRpc(config, "reserve_idempotency_key", {
    p_key: input.idempotencyKey,
    p_endpoint_id: input.endpointId,
    p_request_hash: input.requestHash
  });
  if (!rpc.ok || !Array.isArray(rpc.body)) return { ok: false };

  const row = rpc.body[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) return { ok: false };

  const record = row as Record<string, unknown>;
  const state = record.reservation_state;
  if (!isIdempotencyReservationState(state)) return { ok: false };

  if (state === "reserved" || state === "processing" || state === "failed" || state === "conflict") {
    return { ok: true, value: { state } };
  }

  if (typeof record.response_status !== "number" || record.response_body === null) {
    return { ok: true, value: { state: "failed" } };
  }

  return {
    ok: true,
    value: {
      state: "replay",
      responseStatus: record.response_status,
      responseBody: record.response_body,
      resourceType: typeof record.resource_type === "string" ? record.resource_type : null,
      resourceId: typeof record.resource_id === "string" ? record.resource_id : null
    }
  };
}

async function completePersistentIdempotency(
  config: SupabaseIdempotencyConfig,
  input: {
    endpointId: string;
    idempotencyKey: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    resourceType?: string | null;
    resourceId?: string | null;
  }
): Promise<boolean> {
  const rpc = await callSupabaseRpc(config, "complete_idempotency_key", {
    p_key: input.idempotencyKey,
    p_endpoint_id: input.endpointId,
    p_request_hash: input.requestHash,
    p_response_status: input.responseStatus,
    p_response_body: input.responseBody,
    p_resource_type: input.resourceType ?? null,
    p_resource_id: input.resourceId ?? null
  });

  return rpc.ok;
}

async function callSupabaseRpc(
  config: SupabaseIdempotencyConfig,
  functionName: "reserve_idempotency_key" | "complete_idempotency_key",
  body: Record<string, unknown>
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const endpoint = new URL(`/rest/v1/rpc/${functionName}`, config.url);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      authorization: config.authorization,
      "content-type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  if (!response.ok) return { ok: false };

  return { ok: true, body: await response.json().catch(() => null) };
}

function normalizeSupabaseUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function json(body: unknown, status: number, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

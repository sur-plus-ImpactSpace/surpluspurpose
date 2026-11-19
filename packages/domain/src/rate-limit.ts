import type { ApiRateLimitPolicy } from "./api-contract";

export type RateLimitPolicyConfig = {
  windowMs: number;
  maxRequests: number;
};

export type LocalRateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult =
  | {
      ok: true;
      limit: number;
      remaining: number;
      resetAt: number;
    }
  | {
      ok: false;
      limit: number;
      retryAfterSeconds: number;
      resetAt: number;
    };

export const RATE_LIMIT_POLICIES = {
  read: {
    windowMs: 60_000,
    maxRequests: 300
  },
  mutation: {
    windowMs: 60_000,
    maxRequests: 60
  },
  strict: {
    windowMs: 60_000,
    maxRequests: 20
  },
  webhook: {
    windowMs: 60_000,
    maxRequests: 120
  }
} as const satisfies Record<ApiRateLimitPolicy, RateLimitPolicyConfig>;

export function createRateLimitKey(input: { actorId: string; endpointId: string }): string {
  return `${input.actorId}:${input.endpointId}`;
}

export function reserveLocalRateLimit(
  store: Map<string, LocalRateLimitEntry>,
  input: {
    actorId: string;
    endpointId: string;
    policy: ApiRateLimitPolicy;
    now?: number;
  }
): RateLimitResult {
  const now = input.now ?? Date.now();
  const config = RATE_LIMIT_POLICIES[input.policy];
  const key = createRateLimitKey(input);
  const existing = store.get(key);
  const entry =
    !existing || now >= existing.resetAt
      ? {
          count: 0,
          resetAt: now + config.windowMs
        }
      : existing;

  if (entry.count >= config.maxRequests) {
    store.set(key, entry);

    return {
      ok: false,
      limit: config.maxRequests,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      resetAt: entry.resetAt
    };
  }

  const nextEntry = {
    count: entry.count + 1,
    resetAt: entry.resetAt
  };
  store.set(key, nextEntry);

  return {
    ok: true,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - nextEntry.count),
    resetAt: nextEntry.resetAt
  };
}

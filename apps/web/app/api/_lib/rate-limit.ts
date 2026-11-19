import {
  RATE_LIMIT_POLICIES,
  createRateLimitKey,
  reserveLocalRateLimit,
  reserveSharedRateLimitWithSupabaseRpc,
  type ApiRateLimitPolicy,
  type LocalRateLimitEntry,
  type RateLimitResult
} from "@surplus/domain";
import { NextResponse } from "next/server";

const localRateLimitStore = new Map<string, LocalRateLimitEntry>();

/**
 * Limits hold across all servers when Supabase and the service-role key are
 * configured: the counter lives in Postgres (reserve_rate_limit, 0052). Without
 * them (preview, local) it counts in this process. If the shared store fails,
 * this process counts instead: a degraded limit beats an outage.
 */
export async function enforceRouteRateLimit(input: {
  actorId: string;
  endpointId: string;
  policy: ApiRateLimitPolicy;
}): Promise<NextResponse | null> {
  const result = await reserve(input);
  if (result.ok) return null;

  return NextResponse.json(
    { error: "rate_limit_exceeded" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
      }
    }
  );
}

async function reserve(input: { actorId: string; endpointId: string; policy: ApiRateLimitPolicy }): Promise<RateLimitResult> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    const config = RATE_LIMIT_POLICIES[input.policy];
    try {
      return await reserveSharedRateLimitWithSupabaseRpc(
        { url, key: serviceKey, authorization: `Bearer ${serviceKey}` },
        { key: createRateLimitKey(input), limit: config.maxRequests, windowSeconds: Math.round(config.windowMs / 1000) }
      );
    } catch (error) {
      console.error("shared rate limit unavailable, counting locally", error);
    }
  }

  return reserveLocalRateLimit(localRateLimitStore, input);
}

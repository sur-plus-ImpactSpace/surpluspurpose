"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseBrowserConfig } from "./service-chat-realtime";

type BrowserSupabaseCache = {
  cacheKey: string;
  client: SupabaseClient;
};

let cachedSupabase: BrowserSupabaseCache | null = null;

export function getBrowserSupabaseClient(config: SupabaseBrowserConfig): SupabaseClient {
  const cacheKey = `${config.supabaseUrl}:${config.anonKey}`;
  if (!cachedSupabase || cachedSupabase.cacheKey !== cacheKey) {
    cachedSupabase = {
      cacheKey,
      client: createBrowserClient(config.supabaseUrl, config.anonKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true
        },
        realtime: {
          params: {
            eventsPerSecond: 5
          }
        }
      })
    };
  }

  return cachedSupabase.client;
}

export async function browserRouteHeaders({
  config,
  contentTypeJson = false,
  previewUserId
}: {
  config: SupabaseBrowserConfig | null;
  contentTypeJson?: boolean;
  previewUserId: string;
}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (contentTypeJson) headers["content-type"] = "application/json";

  if (!config) {
    headers["x-surplus-preview-user-id"] = previewUserId;
    return headers;
  }

  const { data } = await getBrowserSupabaseClient(config).auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.authorization = `Bearer ${token}`;

  return headers;
}

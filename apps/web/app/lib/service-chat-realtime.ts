import type { WorkspaceDataSource } from "./workspace-data";

export type SupabaseBrowserConfig = {
  anonKey: string;
  supabaseUrl: string;
};

export type ServiceChatRealtimeConfig = SupabaseBrowserConfig;

export function supabaseBrowserConfigFromEnv(): SupabaseBrowserConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  return {
    anonKey,
    supabaseUrl
  };
}

export function serviceChatRealtimeConfigFromEnv(
  source: WorkspaceDataSource
): ServiceChatRealtimeConfig | null {
  if (source !== "supabase") return null;

  return supabaseBrowserConfigFromEnv();
}

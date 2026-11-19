import { afterEach, describe, expect, it, vi } from "vitest";
import { serviceChatRealtimeConfigFromEnv, supabaseBrowserConfigFromEnv } from "./service-chat-realtime";

describe("serviceChatRealtimeConfigFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps preview workspaces on the persisted route path only", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    expect(serviceChatRealtimeConfigFromEnv("preview")).toBeNull();
  });

  it("requires public Supabase URL and anon key for realtime", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");

    expect(serviceChatRealtimeConfigFromEnv("supabase")).toBeNull();
    expect(supabaseBrowserConfigFromEnv()).toBeNull();
  });

  it("never exposes the service-role key as the realtime browser key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");

    expect(supabaseBrowserConfigFromEnv()).toEqual({
      anonKey: "anon-key",
      supabaseUrl: "https://project.supabase.co"
    });
    expect(serviceChatRealtimeConfigFromEnv("supabase")).toEqual({
      anonKey: "anon-key",
      supabaseUrl: "https://project.supabase.co"
    });
  });
});

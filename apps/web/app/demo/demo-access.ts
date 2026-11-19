import { supabaseBrowserConfigFromEnv } from "../lib/service-chat-realtime";

/**
 * On a real deployment (Supabase configured) the demo is a gated sales tool: it
 * needs ?key=<token> matching SURPLUS_DEMO_ACCESS_TOKEN, and stays closed when no
 * token is configured. A pure demo deployment (no auth backend) is open by design.
 */
export function demoAccessAllowed(key: string | null | undefined): boolean {
  if (!supabaseBrowserConfigFromEnv()) return true;
  const token = process.env.SURPLUS_DEMO_ACCESS_TOKEN;

  return Boolean(token) && key === token;
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseBrowserConfig } from "./service-chat-realtime";

export type ServerSupabaseSession = {
  accessToken: string;
  email: string | null;
  userId: string;
  /** True when the user has a verified second factor but the session is still
   *  at aal1 — the workspace must be gated until they complete the challenge. */
  mfaRequired: boolean;
  /** Current authenticator assurance level of the session. Admins must be at
   *  aal2 (REQ-NFR-03); null when the lookup failed. */
  aal: "aal1" | "aal2" | null;
};

export async function loadServerSupabaseSession(
  config: SupabaseBrowserConfig | null
): Promise<ServerSupabaseSession | null> {
  if (!config) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(config.supabaseUrl, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read auth cookies, but cookie refresh belongs in middleware.
        }
      }
    }
  });

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return null;

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user || user.id !== sessionData.session?.user.id) return null;

  let mfaRequired = false;
  let currentAal: ServerSupabaseSession["aal"] = null;
  try {
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    mfaRequired = aal.data?.currentLevel === "aal1" && aal.data?.nextLevel === "aal2";
    currentAal = aal.data?.currentLevel === "aal2" ? "aal2" : aal.data?.currentLevel === "aal1" ? "aal1" : null;
  } catch {
    // Treat an AAL lookup failure as "not required" rather than locking the user
    // out. Admins still fail closed: their gate requires aal === "aal2".
  }

  return {
    accessToken,
    email: user.email ?? null,
    userId: user.id,
    mfaRequired,
    aal: currentAal
  };
}

/**
 * REQ-NFR-03 / REQ-OPS-14: Ops accounts (admin and editor) work only at aal2.
 * Without a verified factor the workspace stays closed; the database refuses
 * Ops rights below aal2 as well (migrations 0032/0059), so this gate is the
 * friendly front of a server-side rule, not the rule itself.
 */
export function adminMfaMissing(role: string, session: Pick<ServerSupabaseSession, "aal">): boolean {
  return (role === "admin" || role === "editor") && session.aal !== "aal2";
}

/**
 * Mint a short-lived signed URL for a private Storage object (C4 evidence). The
 * client is the user's cookie session, so Storage RLS still applies — the caller
 * must already be a participant of the match the object belongs to. Returns null
 * in preview/demo (no auth backend) or when the object is not readable.
 */
export async function createEvidenceSignedUrl(
  config: SupabaseBrowserConfig | null,
  bucket: string,
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  if (!config) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(config.supabaseUrl, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Read-only: signing a URL never rotates the session.
      }
    }
  });

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

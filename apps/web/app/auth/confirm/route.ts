import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseBrowserConfigFromEnv } from "../../lib/service-chat-realtime";

export const dynamic = "force-dynamic";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Where each kind of link lands when the e-mail did not say. */
const DEFAULT_NEXT: Record<string, string> = {
  signup: "/registered",
  invite: "/",
  magiclink: "/",
  recovery: "/reset-password",
  email_change: "/account",
  email: "/"
};

/**
 * Only same-site destinations: a relative path, or an absolute URL on this very host.
 * Anything else falls back to the default, so the link can never bounce a user elsewhere.
 */
function safeNext(next: string | null, origin: string, fallback: string): string {
  if (!next) return fallback;
  try {
    const url = new URL(next, origin);

    return url.origin === origin ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Landing point of the links in the sign-up, magic-link, invitation and password-reset
 * e-mails (`/auth/confirm?token_hash=…&type=…`). Verifies the one-time code on the
 * server, which sets the session cookies, then sends the user on.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const config = supabaseBrowserConfigFromEnv();

  const invalid = () => NextResponse.redirect(new URL("/login?link=invalid", origin));
  if (!config || !tokenHash || !type || !OTP_TYPES.includes(type)) return invalid();

  const cookieStore = await cookies();
  const supabase = createServerClient(config.supabaseUrl, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      }
    }
  });

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return invalid();

  return NextResponse.redirect(new URL(safeNext(searchParams.get("next"), origin, DEFAULT_NEXT[type] ?? "/"), origin));
}

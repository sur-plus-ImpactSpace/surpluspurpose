import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { adminHostFromEnv, hostName } from "./app/lib/admin-host";
import { supabaseBrowserConfigFromEnv } from "./app/lib/service-chat-realtime";

const cspHeaderName = "Content-Security-Policy";
// Signed-in app pages an admin reaches from the nav, besides /ops.
const ADMIN_APP_PATHS = ["/matches", "/inbox", "/account", "/documents", "/impact"];

export async function proxy(request: NextRequest) {
  const split = splitByHost(request);
  if (split) return split;

  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(cspHeaderName, csp);

  return refreshSupabaseSession(request, requestHeaders, csp);
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};

/**
 * Public site and admin area are one app on two hosts. The admin host only serves
 * /ops (its root is the admin sign-in); the public host does not know /ops at all.
 */
function splitByHost(request: NextRequest): NextResponse | null {
  const adminHost = adminHostFromEnv();
  if (!adminHost) return null;

  const { pathname } = request.nextUrl;
  const onAdminHost = hostName(request.headers.get("host")) === adminHost;
  const isOps = pathname === "/ops" || pathname.startsWith("/ops/");

  if (onAdminHost) {
    if (pathname === "/") return NextResponse.rewrite(new URL("/ops", request.url));
    if (!isOps && !ADMIN_APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return null;
  }

  return isOps ? new NextResponse("Not found", { status: 404 }) : null;
}

async function refreshSupabaseSession(
  request: NextRequest,
  requestHeaders: Headers,
  csp: string
): Promise<NextResponse> {
  const supabaseConfig = supabaseBrowserConfigFromEnv();
  let response = nextResponse(requestHeaders, csp);

  if (!supabaseConfig) return response;

  const supabase = createServerClient(supabaseConfig.supabaseUrl, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = nextResponse(requestHeaders, csp);
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  await supabase.auth.getUser().catch((error: unknown) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("Supabase session refresh failed", error);
    }
  });

  return response;
}

function nextResponse(requestHeaders: Headers, csp: string): NextResponse {
  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.headers.set(cspHeaderName, csp);

  return response;
}

function contentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // Cloudflare Turnstile renders its bot-check challenge in an iframe from this origin.
    "frame-src https://challenges.cloudflare.com",
    // Supabase storage serves the signed proof-document links that admins preview.
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    /*
     * style-src must allow inline STYLE ATTRIBUTES: the role accent (`--sp-accent*`
     * on the shell root) and every dynamic colour reach the DOM via `style={...}`.
     * A nonce only covers <style> elements — attributes are not noncable — and per
     * the CSP spec a nonce in the directive makes 'unsafe-inline' be IGNORED. The
     * previous production value (`style-src 'self' 'nonce-…'`) therefore silently
     * killed every inline style in prod only: the active sidebar link inherited the
     * dark ink colour on the dark sidebar and vanished, and no role accent rendered.
     * Dev never showed it because dev already had 'unsafe-inline'. Keeping both
     * environments identical removes that whole class of prod-only surprise.
     * XSS protection stays with script-src (nonce + strict-dynamic).
     */
    "style-src 'self' 'unsafe-inline'",
    /*
     * Production talks to the hosted Supabase project over https/wss on
     * *.supabase.co. Local development (`supabase start`) talks to the local
     * stack over http/ws on 127.0.0.1 — without these dev-only origins the
     * browser blocks every auth/REST/realtime call to the local backend.
     */
    isDevelopment
      ? "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com http://127.0.0.1:* ws://127.0.0.1:* http://localhost:* ws://localhost:*"
      : "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
    /*
     * upgrade-insecure-requests rewrites the app's own http requests to https;
     * on the http-only local dev server that breaks the CSS/JS assets and the
     * local Supabase calls. Emit it in production only.
     */
    isDevelopment ? null : "upgrade-insecure-requests"
  ]
    .filter(Boolean)
    .join("; ");
}

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

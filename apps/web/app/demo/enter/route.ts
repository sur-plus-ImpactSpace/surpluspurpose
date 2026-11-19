import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_TTL_MS, createSandbox } from "../../lib/demo-sandbox";
import { enforceRouteRateLimit } from "../../api/_lib/rate-limit";
import { demoAccessAllowed } from "../demo-access";

export const dynamic = "force-dynamic";

const ROLES = ["corporate", "ngo", "admin"] as const;

/**
 * Enter the demo: create this visitor's private sandbox, remember it in a cookie
 * and send them into it. Rate limited per address, since every call allocates
 * memory; the sandboxes themselves expire on their own (see demo-sandbox.ts).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const field = (name: string) => {
    const value = form?.get(name);

    return typeof value === "string" ? value : "";
  };
  const key = field("key");
  if (!demoAccessAllowed(key)) return NextResponse.redirect(new URL("/login", request.url), 303);

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limited = await enforceRouteRateLimit({ actorId: `ip:${address}`, endpointId: "demo.enter", policy: "strict" });
  if (limited) return limited;

  const role = (ROLES as readonly string[]).includes(field("role")) ? field("role") : "corporate";
  const query = new URLSearchParams();
  if (role !== "corporate") query.set("role", role);
  if (field("lang") === "de") query.set("lang", "de");
  if (key) query.set("key", key);

  const { id } = createSandbox();
  const response = NextResponse.redirect(new URL(`/demo${query.size ? `?${query}` : ""}`, request.url), 303);
  response.cookies.set(DEMO_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(DEMO_TTL_MS / 1000)
  });

  return response;
}

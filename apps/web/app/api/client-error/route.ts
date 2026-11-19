import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Lightweight error sink: client error boundaries POST here so failures end up
 * in the server (Netlify function) logs without any third-party service.
 * Fire-and-forget by design — never throws, never stores request bodies.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    digest?: unknown;
    message?: unknown;
    url?: unknown;
  } | null;

  console.error("[client-error]", {
    digest: typeof body?.digest === "string" ? body.digest.slice(0, 100) : null,
    message: typeof body?.message === "string" ? body.message.slice(0, 500) : "unknown",
    url: typeof body?.url === "string" ? body.url.slice(0, 200) : null,
    at: new Date().toISOString()
  });

  return NextResponse.json({ ok: true });
}

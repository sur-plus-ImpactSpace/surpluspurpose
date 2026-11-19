import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowserConfigFromEnv } from "../../../../lib/service-chat-realtime";
import { loadServerSupabaseSession } from "../../../../lib/server-supabase";
import { WorkspaceProfileMissingError, loadWorkspaceData } from "../../../../lib/workspace-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ envelopeId: string }> };

/**
 * The signed copy of a donation document. Access follows the envelope row (its
 * parties once verified, and Ops); the file itself sits in a private bucket and
 * is handed out as a short-lived signed URL created with the service role only
 * after that check.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { envelopeId } = await context.params;
  const authConfig = supabaseBrowserConfigFromEnv();
  const session = await loadServerSupabaseSession(authConfig);
  if (authConfig && !session) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const previewActor = !authConfig ? request.nextUrl.searchParams.get("actor") ?? undefined : undefined;
  const workspace = await loadWorkspaceData({
    authorization: session ? `Bearer ${session.accessToken}` : undefined,
    preferredUserId: session?.userId ?? previewActor
  }).catch((error: unknown) => {
    if (error instanceof WorkspaceProfileMissingError) return null;
    throw error;
  });
  if (!workspace) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const envelope = workspace.repository.signatureEnvelopes.list(workspace.actor).find((item) => item.id === envelopeId);
  if (!envelope) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (envelope.state !== "completed" || !envelope.signedStoragePath) {
    return NextResponse.json({ error: "not_signed_yet" }, { status: 409 });
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "storage_not_configured" }, { status: 503 });

  const signed = await fetch(`${url.replace(/\/+$/, "")}/storage/v1/object/sign/signed-documents/${envelope.signedStoragePath}`, {
    method: "POST",
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 })
  }).catch(() => null);
  const payload = (await signed?.json().catch(() => null)) as { signedURL?: string } | null;
  if (!signed?.ok || !payload?.signedURL) return NextResponse.json({ error: "file_unavailable" }, { status: 404 });

  return NextResponse.redirect(`${url.replace(/\/+$/, "")}/storage/v1${payload.signedURL}`);
}

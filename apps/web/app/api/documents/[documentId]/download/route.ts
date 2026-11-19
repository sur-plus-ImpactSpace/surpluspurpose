import { buildCertificateRenderData } from "@surplus/domain";
import { NextRequest, NextResponse } from "next/server";
import { supabaseBrowserConfigFromEnv } from "../../../../lib/service-chat-realtime";
import { createEvidenceSignedUrl, loadServerSupabaseSession } from "../../../../lib/server-supabase";
import { WorkspaceProfileMissingError, loadWorkspaceData } from "../../../../lib/workspace-data";
import { escapeHtml, renderDocumentHtml } from "./render-document";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

/**
 * Renders generated evidence documents (donation certificate, CSRD note) as a
 * printable HTML page. Downloads are plain browser GETs, so auth follows the
 * page model (Supabase session cookie) instead of the header-based route
 * workspace. In pure preview/demo deployments the acting seed user comes from
 * `?actor=` — preview data is public by design.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { documentId } = await context.params;
  const authConfig = supabaseBrowserConfigFromEnv();
  const session = await loadServerSupabaseSession(authConfig);
  if (authConfig && !session) {
    return htmlError(401, "Sign in to download this document.");
  }

  const previewActor = !authConfig ? request.nextUrl.searchParams.get("actor") ?? undefined : undefined;
  const workspace = await loadWorkspaceData({
    authorization: session ? `Bearer ${session.accessToken}` : undefined,
    preferredUserId: session?.userId ?? previewActor
  }).catch((error: unknown) => {
    if (error instanceof WorkspaceProfileMissingError) return null;
    throw error;
  });
  if (!workspace) return htmlError(404, "Document not found.");

  const { actor, data, repository } = workspace;
  const document = repository.documents.get(documentId, actor);
  if (!document) return htmlError(404, "Document not found.");

  // Uploaded evidence (C4): redirect to a short-lived signed URL from the
  // private bucket instead of the certificate renderer. Access to the document
  // row is already gated by documents.get above; Storage RLS re-checks on sign.
  // Generated docs (donation certificate, CSRD note) are always rendered from
  // the audited match record and gated by buildCertificateRenderData below —
  // they must never be short-circuited into the file path, even if a legacy
  // storagePath is present, so the "not yet released" 409 gate still applies.
  if (document.storagePath && document.kind !== "certificate" && document.kind !== "report") {
    const signed = await createEvidenceSignedUrl(authConfig, "match-evidence", document.storagePath);
    if (!signed) return htmlError(404, "This file is not available.");
    return NextResponse.redirect(signed);
  }

  const match = data.matches.find((item) => item.id === document.matchId);
  const listing = data.listings.find((item) => item.id === match?.listingId);
  const need = data.needs.find((item) => item.id === match?.needId);
  const ngo = data.ngos.find((item) => item.id === need?.ngoId);
  const company = data.companies.find((item) => item.id === listing?.companyId);

  const result = buildCertificateRenderData({ document, match, listing, need, ngo, company });
  if (!result.ok) {
    if (result.reason === "document_not_ready") {
      return htmlError(
        409,
        "This document becomes available once the match is confirmed by both sides."
      );
    }
    return htmlError(404, "This document has no generated version.");
  }

  return new NextResponse(renderDocumentHtml(result.data), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function htmlError(status: number, message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>sur.plus</title>
     <body style="font-family:system-ui;margin:4rem auto;max-width:32rem;color:#1e2a23">
     <p style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#2f6f4f">sur.plus</p>
     <h1 style="font-size:20px">${escapeHtml(message)}</h1></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } }
  );
}

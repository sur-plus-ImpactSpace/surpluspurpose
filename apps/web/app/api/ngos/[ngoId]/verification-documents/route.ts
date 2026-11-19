import { NextRequest } from "next/server";
import { supabaseBrowserConfigFromEnv } from "../../../../lib/service-chat-realtime";
import { adminMfaMissing, createEvidenceSignedUrl, loadServerSupabaseSession } from "../../../../lib/server-supabase";
import { WorkspaceProfileMissingError, loadWorkspaceData } from "../../../../lib/workspace-data";

export const dynamic = "force-dynamic";

const BUCKET = "ngo-verification";

type RouteContext = {
  params: Promise<{ ngoId: string }>;
};

type DocumentRow = {
  id: string;
  proof_kind: string;
  title: string | null;
  storage_path: string;
  mime: string | null;
  created_at: string;
};

/**
 * Ops-only: list an NGO's verification proof documents (REQ-NGO-02) with a
 * short-lived signed download URL per file. Read follows the page/cookie model
 * like the document download route; the admin guard is enforced here and RLS on
 * ngo_verification_documents + the private bucket re-checks on the server. In
 * preview/demo (no auth backend) there are no real uploads, so it returns [].
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { ngoId } = await context.params;
  const authConfig = supabaseBrowserConfigFromEnv();

  // Preview/demo: no Supabase backend, no real uploads to list.
  if (!authConfig) {
    return Response.json({ documents: [] });
  }

  const session = await loadServerSupabaseSession(authConfig);
  if (!session) {
    return Response.json({ error: "auth_required" }, { status: 401 });
  }

  const workspace = await loadWorkspaceData({
    authorization: `Bearer ${session.accessToken}`,
    preferredUserId: session.userId
  }).catch((error: unknown) => {
    if (error instanceof WorkspaceProfileMissingError) return null;
    throw error;
  });
  if (!workspace) {
    return Response.json({ error: "workspace_not_found" }, { status: 404 });
  }
  if (workspace.actor.role !== "admin") {
    return Response.json({ error: "actor_not_allowed" }, { status: 403 });
  }
  if (adminMfaMissing(workspace.actor.role, session)) {
    return Response.json({ error: "mfa_required" }, { status: 403 });
  }

  // Admin JWT + RLS (admin may read all rows). Never the service role.
  const query = new URLSearchParams({
    ngo_id: `eq.${ngoId}`,
    select: "id,proof_kind,title,storage_path,mime,created_at",
    order: "created_at.desc"
  });
  const response = await fetch(`${authConfig.supabaseUrl}/rest/v1/ngo_verification_documents?${query}`, {
    headers: {
      apikey: authConfig.anonKey,
      authorization: `Bearer ${session.accessToken}`
    },
    cache: "no-store"
  });
  if (!response.ok) {
    return Response.json({ error: "list_failed" }, { status: 502 });
  }

  const rows = (await response.json()) as DocumentRow[];
  const documents = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      proofKind: row.proof_kind,
      title: row.title,
      mime: row.mime,
      createdAt: row.created_at,
      url: await createEvidenceSignedUrl(authConfig, BUCKET, row.storage_path)
    }))
  );

  return Response.json({ documents });
}

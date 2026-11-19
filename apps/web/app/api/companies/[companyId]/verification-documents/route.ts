import { NextRequest } from "next/server";
import { supabaseBrowserConfigFromEnv } from "../../../../lib/service-chat-realtime";
import { adminMfaMissing, createEvidenceSignedUrl, loadServerSupabaseSession } from "../../../../lib/server-supabase";
import { WorkspaceProfileMissingError, loadWorkspaceData } from "../../../../lib/workspace-data";

export const dynamic = "force-dynamic";

const BUCKET = "company-verification";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

type DocumentRow = {
  id: string;
  title: string | null;
  storage_path: string;
  mime: string | null;
  created_at: string;
};

/**
 * Ops-only: list a company's verification proof documents (ADR 0027 C1) with a
 * short-lived signed download URL per file. Mirrors the NGO route: read follows
 * the page/cookie model, the admin guard is enforced here and RLS on
 * company_verification_documents + the private bucket re-checks on the server.
 * In preview/demo (no auth backend) there are no real uploads, so it returns [].
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params;
  const authConfig = supabaseBrowserConfigFromEnv();

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

  const query = new URLSearchParams({
    company_id: `eq.${companyId}`,
    select: "id,title,storage_path,mime,created_at",
    order: "created_at.desc"
  });
  const response = await fetch(
    `${authConfig.supabaseUrl}/rest/v1/company_verification_documents?${query}`,
    {
      headers: {
        apikey: authConfig.anonKey,
        authorization: `Bearer ${session.accessToken}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) {
    return Response.json({ error: "list_failed" }, { status: 502 });
  }

  const rows = (await response.json()) as DocumentRow[];
  const documents = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      title: row.title,
      mime: row.mime,
      createdAt: row.created_at,
      url: await createEvidenceSignedUrl(authConfig, BUCKET, row.storage_path)
    }))
  );

  return Response.json({ documents });
}

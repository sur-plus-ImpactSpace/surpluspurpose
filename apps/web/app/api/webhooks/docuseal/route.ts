import { applyDocusealEventWithServiceRole, SupabaseRepositoryError, type DocusealEvent } from "@surplus/domain";
import { NextRequest } from "next/server";
import { isDocusealFileUrl, verifyDocusealWebhook } from "../../_lib/docuseal";
import { enforceRouteRateLimit } from "../../_lib/rate-limit";
import { loadPublicRouteRuntime, routeJson } from "../../_lib/route-workspace";

export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

type Payload = {
  event_type?: unknown;
  data?: {
    id?: unknown;
    email?: unknown;
    submission_id?: unknown;
    submission?: { id?: unknown };
    documents?: Array<{ url?: unknown }>;
    combined_document_url?: unknown;
  };
};

const EVENTS: Record<string, DocusealEvent["event"]> = {
  "form.viewed": "viewed",
  "form.completed": "signed",
  "form.declined": "declined",
  "submission.completed": "completed",
  "submission.expired": "voided",
  "submission.archived": "voided"
};

/**
 * DocuSeal reports signing progress here, and only here do signature states
 * change (invariant 5). The shared-secret header is checked first, in constant
 * time. For a completed submission the signed PDF is fetched from DocuSeal's own
 * hosts and stored in the private signed-documents bucket before the envelope
 * is marked completed with its path.
 */
export async function POST(request: NextRequest) {
  const rateLimit = await enforceRouteRateLimit({ actorId: "docuseal", endpointId: "docuseal.webhook", policy: "webhook" });
  if (rateLimit) return rateLimit;
  if (!verifyDocusealWebhook(request.headers)) return routeJson({ error: "invalid_secret" }, 401);

  const payload = (await request.json().catch(() => undefined)) as Payload | undefined;
  const mapped = typeof payload?.event_type === "string" ? EVENTS[payload.event_type] : undefined;
  if (!payload || !mapped) return routeJson({ received: true, ignored: true }, 200);

  const data = payload.data ?? {};
  const isSubmissionEvent = String(payload.event_type).startsWith("submission.");
  const submissionId = isSubmissionEvent ? data.id : (data.submission?.id ?? data.submission_id);
  if (typeof submissionId !== "number" && typeof submissionId !== "string") return routeJson({ received: true, ignored: true }, 200);
  const event: DocusealEvent = {
    externalId: String(submissionId),
    event: mapped,
    email: typeof data.email === "string" ? data.email : null
  };

  // Supabase configured: the service role applies the event. Never fall back to
  // preview data when Supabase is configured (invariant 8).
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const service = url && serviceKey ? { url, key: serviceKey, authorization: `Bearer ${serviceKey}` } : null;
  const preview = service ? null : loadPublicRouteRuntime();
  if (preview && !preview.ok) return preview.response;
  if (preview?.ok && preview.runtime === "supabase") return routeJson({ error: "service_role_not_configured" }, 503);

  if (mapped === "completed") {
    const fileUrl = data.documents?.[0]?.url ?? data.combined_document_url;
    const path = service ? await storeSignedCopy(service, event.externalId, fileUrl) : null;
    if (path) event.signedStoragePath = path;
  }

  try {
    const state =
      service
        ? await applyDocusealEventWithServiceRole(service, event)
        : preview?.ok && preview.runtime === "preview"
          ? (preview.repository.signatureEnvelopes.applyDocusealEvent(event) ?? "unknown_envelope")
          : "unknown_envelope";

    // An unknown submission is acknowledged: retrying will not make it appear.
    return routeJson({ received: true, state }, 200);
  } catch (error) {
    if (error instanceof SupabaseRepositoryError && error.message.includes("envelope_not_found")) {
      return routeJson({ received: true, ignored: true }, 200);
    }
    console.error("docuseal event failed", error);

    // A non-2xx answer makes DocuSeal retry.
    return routeJson({ error: "persistence_unavailable" }, 503);
  }
}

/** Download the signed PDF from DocuSeal and keep it in private storage. Returns the path, or null when it could not be kept. */
async function storeSignedCopy(
  service: { url: string; key: string; authorization: string },
  externalId: string,
  fileUrl: unknown
): Promise<string | null> {
  if (!isDocusealFileUrl(fileUrl)) {
    console.error("signed copy skipped: not a DocuSeal file URL", externalId);

    return null;
  }
  try {
    const file = await fetch(fileUrl, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    if (!file.ok) return null;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES) return null;

    const path = `${externalId.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    const upload = await fetch(`${service.url.replace(/\/+$/, "")}/storage/v1/object/signed-documents/${path}`, {
      method: "POST",
      headers: { apikey: service.key, authorization: service.authorization, "content-type": "application/pdf", "x-upsert": "true" },
      body: bytes,
      signal: AbortSignal.timeout(30_000)
    });

    return upload.ok ? path : null;
  } catch (error) {
    console.error("signed copy could not be stored", externalId, error);

    return null;
  }
}

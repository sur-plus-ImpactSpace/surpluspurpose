import {
  SupabaseRepositoryError,
  buildCertificateRenderData,
  createSignatureEnvelopeWithSupabaseRpc,
  parseSignatureEnvelopeCommand,
  type SignatureEnvelopeInput,
  type SupabaseRestConfig
} from "@surplus/domain";
import { NextRequest } from "next/server";
import { docusealConfigFromEnv, createSigningSubmission } from "../_lib/docuseal";
import { reserveRouteIdempotency } from "../_lib/idempotency";
import { enforceRouteRateLimit } from "../_lib/rate-limit";
import { loadRouteWorkspace, routeJson } from "../_lib/route-workspace";
import { renderDocumentHtml } from "../documents/[documentId]/download/render-document";

export const dynamic = "force-dynamic";

/**
 * Ops sends a donation certificate for e-signature: DocuSeal gets the certificate
 * with a signature field for the company and one for the NGO and emails both
 * signers; the envelope is recorded here as `sent`. From then on its state moves
 * only through DocuSeal's webhook (invariant 5). Without a DocuSeal key this
 * fails closed.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => undefined);
  const command = parseSignatureEnvelopeCommand(request.headers, body);
  if (!command.ok) return routeJson({ error: command.reason }, command.status);

  const workspaceDecision = await loadRouteWorkspace(request);
  if (!workspaceDecision.ok) return workspaceDecision.response;

  const { actor, data, repository, runtime, supabase } = workspaceDecision.workspace;
  if (actor.role !== "admin") return routeJson({ error: "actor_not_allowed" }, 403);

  const document = repository.documents.get(command.command.documentId, actor);
  if (!document) return routeJson({ error: "document_not_found" }, 404);
  if (document.kind !== "certificate") return routeJson({ error: "not_signable" }, 422);

  const docuseal = docusealConfigFromEnv();
  if (!docuseal) return routeJson({ error: "esign_not_configured" }, 503);

  const match = data.matches.find((item) => item.id === document.matchId);
  const listing = data.listings.find((item) => item.id === match?.listingId);
  const need = data.needs.find((item) => item.id === match?.needId);
  const ngo = data.ngos.find((item) => item.id === need?.ngoId);
  const company = data.companies.find((item) => item.id === listing?.companyId);
  const render = buildCertificateRenderData({ document, match, listing, need, ngo, company });
  if (!render.ok) return routeJson({ error: "document_not_ready" }, 409);
  if (!company?.contactEmail || !ngo?.contactEmail) return routeJson({ error: "signer_email_missing" }, 422);
  if (repository.signatureEnvelopes.list(actor).some((item) => item.documentId === document.id && item.state !== "declined" && item.state !== "voided")) {
    return routeJson({ error: "envelope_exists" }, 409);
  }

  const endpointId = "signatureEnvelopes.create";
  const rateLimit = await enforceRouteRateLimit({ actorId: actor.userId, endpointId, policy: "strict" });
  if (rateLimit) return rateLimit;

  const idempotency = await reserveRouteIdempotency({
    request,
    actorId: actor.userId,
    endpointId,
    idempotencyKey: command.command.idempotencyKey,
    body: { documentId: document.id }
  });
  if (idempotency.kind === "response") return idempotency.response;

  const submission = await createSigningSubmission(docuseal, {
    name: `${render.data.documentTitle} · ${render.data.reference}`,
    html: renderDocumentHtml(render.data, { forSigning: true }),
    company: { name: company.ownerName || company.name, email: company.contactEmail },
    ngo: { name: ngo.boardContact || ngo.name, email: ngo.contactEmail }
  });
  if ("error" in submission) {
    await idempotency.fail();

    return routeJson({ error: submission.error }, 503);
  }

  const input: SignatureEnvelopeInput = {
    documentId: document.id,
    externalId: submission.externalId,
    companyName: company.ownerName || company.name,
    companyEmail: company.contactEmail,
    ngoName: ngo.boardContact || ngo.name,
    ngoEmail: ngo.contactEmail
  };
  const result =
    runtime === "supabase" ? await recordPersistentEnvelope(supabase, input) : repository.signatureEnvelopes.create(actor, input);
  if (!result.ok) {
    const status = result.reason === "persistence_unavailable" ? 503 : result.reason === "envelope_exists" ? 409 : 422;
    // The signers may already have been emailed by DocuSeal; that is logged, not hidden.
    console.error("signature envelope not recorded after DocuSeal submission", submission.externalId, result.reason);
    await idempotency.complete({ responseStatus: status, responseBody: { error: result.reason } });

    return routeJson({ error: result.reason }, status);
  }

  const response = { idempotencyKey: command.command.idempotencyKey, externalId: submission.externalId, runtime };
  const completed = await idempotency.complete({
    responseStatus: 201,
    responseBody: response,
    resourceType: "signature_envelope",
    resourceId: submission.externalId
  });
  if (!completed) {
    await idempotency.fail();

    return routeJson({ error: "idempotency_completion_failed" }, 503);
  }

  return routeJson(response, 201);
}

async function recordPersistentEnvelope(supabase: SupabaseRestConfig, input: SignatureEnvelopeInput) {
  try {
    await createSignatureEnvelopeWithSupabaseRpc(supabase, input);

    return { ok: true as const };
  } catch (error) {
    if (!(error instanceof SupabaseRepositoryError)) return { ok: false as const, reason: "persistence_unavailable" };
    const reason = ["actor_not_allowed", "document_not_found", "not_signable", "envelope_exists", "invalid_envelope"].find((item) =>
      error.message.includes(item)
    );

    return { ok: false as const, reason: reason ?? "persistence_unavailable" };
  }
}

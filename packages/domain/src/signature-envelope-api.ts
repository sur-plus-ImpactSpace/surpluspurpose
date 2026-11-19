export type SignatureEnvelopeCommand = { idempotencyKey: string; documentId: string };

export type SignatureEnvelopeCommandResult =
  | { ok: true; command: SignatureEnvelopeCommand }
  | { ok: false; reason: "missing_idempotency_key" | "invalid_payload" | "invalid_document_id"; status: 400 | 422 | 428 };

/** Shape check for "send this document for e-signature". The admin guard and the document rules live in the repository and create_signature_envelope. */
export function parseSignatureEnvelopeCommand(headers: { get(name: string): string | null }, body: unknown): SignatureEnvelopeCommandResult {
  const idempotencyKey = headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return { ok: false, reason: "missing_idempotency_key", status: 428 };
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, reason: "invalid_payload", status: 400 };

  const documentId = (body as Record<string, unknown>).documentId;
  if (typeof documentId !== "string" || !documentId.trim()) return { ok: false, reason: "invalid_document_id", status: 422 };

  return { ok: true, command: { idempotencyKey, documentId: documentId.trim() } };
}

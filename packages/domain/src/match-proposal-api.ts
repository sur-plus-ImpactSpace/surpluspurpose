export const MATCH_PROPOSAL_IDEMPOTENCY_HEADER = "idempotency-key";

export type MatchProposalHeaderReader = {
  get(name: string): string | null;
};

export type MatchProposalCommand = {
  idempotencyKey: string;
  listingId: string;
  needId: string;
  /** Optional: the part of the need to cover (ADR 0028 D3). */
  quantity?: number;
};

export type MatchProposalCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_listing_id"
  | "invalid_need_id"
  | "invalid_quantity";

export type MatchProposalCommandResult =
  | { ok: true; command: MatchProposalCommand }
  | { ok: false; reason: MatchProposalCommandErrorReason; status: 400 | 422 | 428 };

/**
 * Validate a "propose this listing to that need" request. Pure shape check: the
 * admin guard, the listing/need state rules and the duplicate check live in
 * repository.matches.propose and the propose_match RPC (0033), never here.
 */
export function parseMatchProposalCommand(
  headers: MatchProposalHeaderReader,
  body: unknown
): MatchProposalCommandResult {
  const idempotencyKey = headers.get(MATCH_PROPOSAL_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const { listingId, needId, quantity } = body as Record<string, unknown>;
  if (typeof listingId !== "string" || !listingId.trim()) {
    return { ok: false, reason: "invalid_listing_id", status: 422 };
  }
  if (typeof needId !== "string" || !needId.trim()) {
    return { ok: false, reason: "invalid_need_id", status: 422 };
  }

  if (quantity !== undefined && quantity !== null && (!Number.isInteger(quantity) || (quantity as number) <= 0)) {
    return { ok: false, reason: "invalid_quantity", status: 422 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      listingId: listingId.trim(),
      needId: needId.trim(),
      ...(typeof quantity === "number" ? { quantity } : {})
    }
  };
}

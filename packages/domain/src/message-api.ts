export const MESSAGE_IDEMPOTENCY_HEADER = "idempotency-key";

export type MessageHeaderReader = {
  get(name: string): string | null;
};

export type MessageCommand = {
  idempotencyKey: string;
  matchId: string;
  body: string;
};

export type MessageCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_match_id"
  | "invalid_payload"
  | "empty_body"
  | "body_too_long";

export type MessageCommandResult =
  | { ok: true; command: MessageCommand }
  | { ok: false; reason: MessageCommandErrorReason; status: 400 | 413 | 422 | 428 };

export function parseMessageCommand(
  headers: MessageHeaderReader,
  input: {
    matchId: unknown;
    body: unknown;
  }
): MessageCommandResult {
  const idempotencyKey = headers.get(MESSAGE_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof input.matchId !== "string" || !input.matchId.trim()) {
    return { ok: false, reason: "invalid_match_id", status: 400 };
  }
  if (typeof input.body !== "string") {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const body = input.body.trim();
  if (!body) {
    return { ok: false, reason: "empty_body", status: 422 };
  }
  if (body.length > 2000) {
    return { ok: false, reason: "body_too_long", status: 413 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      matchId: input.matchId.trim(),
      body
    }
  };
}

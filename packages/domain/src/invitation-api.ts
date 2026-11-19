import type { InvitationCreateInput } from "./repository";

export const INVITATION_IDEMPOTENCY_HEADER = "idempotency-key";
export const INVITATION_OPERATIONS = ["revoke", "resend"] as const;
export type InvitationOperation = (typeof INVITATION_OPERATIONS)[number];

export type InvitationHeaderReader = {
  get(name: string): string | null;
};

export type InvitationCommand = {
  idempotencyKey: string;
  input: InvitationCreateInput;
};

export type InvitationCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_invitation";

export type InvitationCommandResult =
  | { ok: true; command: InvitationCommand }
  | { ok: false; reason: InvitationCommandErrorReason; status: 400 | 422 | 428 };

export type InvitationMutationCommand = {
  idempotencyKey: string;
  invitationId: string;
  operation: InvitationOperation;
};

export type InvitationMutationCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_invitation_id"
  | "invalid_operation";

export type InvitationMutationCommandResult =
  | { ok: true; command: InvitationMutationCommand }
  | { ok: false; reason: InvitationMutationCommandErrorReason; status: 400 | 422 | 428 };

export type InvitationAcceptanceCommand = {
  fullName: string | null;
  token: string;
};

export type InvitationAcceptanceCommandErrorReason = "invalid_payload" | "invalid_invitation_token";

export type InvitationAcceptanceCommandResult =
  | { ok: true; command: InvitationAcceptanceCommand }
  | { ok: false; reason: InvitationAcceptanceCommandErrorReason; status: 400 | 422 };

export function parseInvitationCommand(
  headers: InvitationHeaderReader,
  body: unknown
): InvitationCommandResult {
  const idempotencyKey = headers.get(INVITATION_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }

  const payload = objectPayload(body);
  if (!payload) return { ok: false, reason: "invalid_payload", status: 400 };

  const email = payload.email;
  const role = payload.role;
  if (typeof email !== "string" || !email.trim().includes("@")) {
    return { ok: false, reason: "invalid_invitation", status: 422 };
  }
  if (role !== "corporate" && role !== "ngo") {
    return { ok: false, reason: "invalid_invitation", status: 422 };
  }

  const companyId = optionalString(payload.companyId);
  const ngoId = optionalString(payload.ngoId);
  const orgName = optionalString(payload.orgName);
  const expiresAt = optionalString(payload.expiresAt);
  if (companyId === null || ngoId === null || orgName === null || expiresAt === null) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      input: {
        email: email.trim().toLowerCase(),
        role,
        companyId,
        ngoId,
        orgName,
        expiresAt: expiresAt ?? null
      }
    }
  };
}

export function parseInvitationMutationCommand(
  headers: InvitationHeaderReader,
  input: {
    invitationId: unknown;
    operation: unknown;
  }
): InvitationMutationCommandResult {
  const idempotencyKey = headers.get(INVITATION_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }

  if (typeof input.invitationId !== "string" || !input.invitationId.trim()) {
    return { ok: false, reason: "invalid_invitation_id", status: 400 };
  }
  if (typeof input.operation !== "string" || !isInvitationOperation(input.operation)) {
    return { ok: false, reason: "invalid_operation", status: 422 };
  }

  return {
    ok: true,
    command: {
      idempotencyKey,
      invitationId: input.invitationId.trim(),
      operation: input.operation
    }
  };
}

export function parseInvitationAcceptanceCommand(body: unknown): InvitationAcceptanceCommandResult {
  const payload = objectPayload(body);
  if (!payload) return { ok: false, reason: "invalid_payload", status: 400 };

  const token = payload.token;
  const fullName = optionalString(payload.fullName);
  if (typeof token !== "string" || token.trim().length < 32) {
    return { ok: false, reason: "invalid_invitation_token", status: 422 };
  }
  if (fullName === null) return { ok: false, reason: "invalid_payload", status: 400 };

  return {
    ok: true,
    command: {
      fullName: fullName ?? null,
      token: token.trim()
    }
  };
}

export function isInvitationOperation(value: string): value is InvitationOperation {
  return INVITATION_OPERATIONS.includes(value as InvitationOperation);
}

function objectPayload(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed || undefined;
}

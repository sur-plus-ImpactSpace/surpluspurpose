import { ACCESS_REQUEST_ROLES, type AccessRequestRole } from "./model";

export const ACCESS_REQUEST_IDEMPOTENCY_HEADER = "idempotency-key";

export type AccessRequestHeaderReader = {
  get(name: string): string | null;
};

export type AccessRequestInput = {
  name: string;
  organization: string;
  role: AccessRequestRole;
  email: string;
  phone: string | null;
  message: string | null;
};

export type AccessRequestCommand = {
  idempotencyKey: string;
  input: AccessRequestInput;
  /** The hidden honeypot field was filled in: a bot. Accept silently, store nothing. */
  spam: boolean;
};

export type AccessRequestCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_payload"
  | "invalid_name"
  | "invalid_organization"
  | "invalid_role"
  | "invalid_email"
  | "invalid_phone"
  | "invalid_message"
  | "consent_required";

export type AccessRequestCommandResult =
  | { ok: true; command: AccessRequestCommand }
  | { ok: false; reason: AccessRequestCommandErrorReason; status: 400 | 422 | 428 };

const MAX_NAME = 200;
const MAX_PHONE = 50;
const MAX_MESSAGE = 2000;
const MAX_EMAIL = 254;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Validate the public "Request access" form. Pure shape check; the same limits
 * are enforced again in submit_access_request (0036), which is what the
 * database trusts. `consent` is the privacy-policy tick box.
 */
export function parseAccessRequestCommand(
  headers: AccessRequestHeaderReader,
  body: unknown
): AccessRequestCommandResult {
  const idempotencyKey = headers.get(ACCESS_REQUEST_IDEMPOTENCY_HEADER)?.trim();
  if (!idempotencyKey) {
    return { ok: false, reason: "missing_idempotency_key", status: 428 };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const payload = body as Record<string, unknown>;
  const name = text(payload.name);
  if (!name || name.length > MAX_NAME) return invalid("invalid_name");
  const organization = text(payload.organization);
  if (!organization || organization.length > MAX_NAME) return invalid("invalid_organization");
  const role = text(payload.role);
  if (!(ACCESS_REQUEST_ROLES as readonly string[]).includes(role)) return invalid("invalid_role");
  const email = text(payload.email).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > MAX_EMAIL) return invalid("invalid_email");
  const phone = text(payload.phone);
  if (phone.length > MAX_PHONE) return invalid("invalid_phone");
  const message = text(payload.message);
  if (message.length > MAX_MESSAGE) return invalid("invalid_message");
  if (payload.consent !== true) return invalid("consent_required");

  return {
    ok: true,
    command: {
      idempotencyKey,
      spam: text(payload.website) !== "",
      input: {
        name,
        organization,
        role: role as AccessRequestRole,
        email,
        phone: phone || null,
        message: message || null
      }
    }
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function invalid(reason: AccessRequestCommandErrorReason): AccessRequestCommandResult {
  return { ok: false, reason, status: 422 };
}

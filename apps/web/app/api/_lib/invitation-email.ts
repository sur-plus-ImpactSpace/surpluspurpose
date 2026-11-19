import type { AccessRequestInput, Invitation } from "@surplus/domain";

export type InvitationEmailDelivery =
  | {
      provider: "resend" | "webhook";
      status: "sent";
      messageId: string | null;
    }
  | {
      provider: "resend" | "webhook";
      status: "failed";
      error: string;
    }
  | {
      provider: "not_configured";
      status: "skipped";
      reason: "email_provider_not_configured";
    };

export type InvitationEmailInput = {
  acceptanceUrl: string;
  invitation: Invitation;
};

type EmailPayload = {
  html: string;
  subject: string;
  text: string;
  to: string;
};

export async function deliverInvitationEmail(
  input: InvitationEmailInput,
  fetchImpl: typeof fetch = fetch
): Promise<InvitationEmailDelivery> {
  return deliverEmail(invitationEmailPayload(input), fetchImpl);
}

/**
 * Tells Ops a visitor asked for access (SURPLUS_OPS_NOTIFY_EMAIL). Best effort:
 * the request is already stored, so a missing address or a delivery failure is
 * reported to the caller, never thrown.
 */
export async function deliverAccessRequestNotice(
  input: AccessRequestInput,
  fetchImpl: typeof fetch = fetch
): Promise<InvitationEmailDelivery> {
  const to = process.env.SURPLUS_OPS_NOTIFY_EMAIL;
  if (!to) return { provider: "not_configured", reason: "email_provider_not_configured", status: "skipped" };

  const kind = input.role === "corporate" ? "Corporate" : "NGO";
  const lines = [
    `Name: ${input.name}`,
    `Organisation: ${input.organization}`,
    `Type: ${kind}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone ?? "—"}`,
    `Message: ${input.message ?? "—"}`
  ];

  return deliverEmail(
    {
      to,
      subject: `New sur.plus access request (${kind})`,
      text: [...lines, "", "Review it in the Ops cockpit and send an invitation."].join("\n"),
      html: `<p>New access request:</p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p>Review it in the Ops cockpit and send an invitation.</p>`
    },
    fetchImpl
  );
}

/** The set-password link for a newly invited admin. */
export async function deliverAdminInviteEmail(
  to: string,
  link: string,
  fetchImpl: typeof fetch = fetch
): Promise<InvitationEmailDelivery> {
  return deliverEmail(
    {
      to,
      subject: "You have been invited as a sur.plus admin",
      text: ["You have been invited to administer sur.plus.", "", "Open this link to choose your password:", link].join("\n"),
      html: `<p>You have been invited to administer <strong>sur.plus</strong>.</p><p><a href="${escapeHtml(link)}">Choose your password</a></p>`
    },
    fetchImpl
  );
}

/** Ops answers a lead from the "Request access" form: here is where to create the account. */
export async function deliverAccessInviteEmail(
  to: string,
  name: string,
  signUpUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<InvitationEmailDelivery> {
  return deliverEmail(
    {
      to,
      subject: "You can now join sur.plus",
      text: [`Hello ${name},`, "", "Thanks for your interest in sur.plus. Create your account here:", signUpUrl, "", "Use this email address when you sign up."].join("\n"),
      html: `<p>Hello ${escapeHtml(name)},</p><p>Thanks for your interest in <strong>sur.plus</strong>.</p><p><a href="${escapeHtml(signUpUrl)}">Create your account</a></p><p>Use this email address when you sign up.</p>`
    },
    fetchImpl
  );
}

async function deliverEmail(payload: EmailPayload, fetchImpl: typeof fetch): Promise<InvitationEmailDelivery> {
  const resendKey = process.env.RESEND_API_KEY;
  const webhookUrl = process.env.SURPLUS_INVITE_WEBHOOK_URL;

  if (resendKey) return deliverWithResend(payload, resendKey, fetchImpl);
  if (webhookUrl) return deliverWithWebhook(payload, webhookUrl, fetchImpl);

  return {
    provider: "not_configured",
    reason: "email_provider_not_configured",
    status: "skipped"
  };
}

function invitationEmailPayload({ acceptanceUrl, invitation }: InvitationEmailInput): EmailPayload {
  const workspace = invitation.orgName ?? (invitation.role === "corporate" ? "Corporate workspace" : "NGO workspace");
  const subject = `Your sur.plus ${invitation.role === "corporate" ? "Corporate" : "NGO"} invite`;
  const text = [
    `You have been invited to ${workspace} on sur.plus.`,
    "",
    "Open this link after signing in to activate workspace access:",
    acceptanceUrl,
    "",
    invitation.expiresAt ? `This invitation expires on ${invitation.expiresAt}.` : "This invitation can be revoked by sur.plus."
  ].join("\n");

  return {
    html: `<p>You have been invited to <strong>${escapeHtml(workspace)}</strong> on sur.plus.</p><p><a href="${escapeHtml(acceptanceUrl)}">Activate workspace access</a></p><p>${escapeHtml(invitation.expiresAt ? `This invitation expires on ${invitation.expiresAt}.` : "This invitation can be revoked by sur.plus.")}</p>`,
    subject,
    text,
    to: invitation.email
  };
}

async function deliverWithResend(
  payload: EmailPayload,
  apiKey: string,
  fetchImpl: typeof fetch
): Promise<InvitationEmailDelivery> {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.SURPLUS_INVITE_FROM_EMAIL ?? "sur.plus <no-reply@sur.plus>",
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      error: await deliveryError(response),
      provider: "resend",
      status: "failed"
    };
  }

  const body = (await response.json().catch(() => null)) as { id?: unknown } | null;

  return {
    messageId: typeof body?.id === "string" ? body.id : null,
    provider: "resend",
    status: "sent"
  };
}

async function deliverWithWebhook(
  payload: EmailPayload,
  webhookUrl: string,
  fetchImpl: typeof fetch
): Promise<InvitationEmailDelivery> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  const token = process.env.SURPLUS_INVITE_WEBHOOK_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...payload,
      from: process.env.SURPLUS_INVITE_FROM_EMAIL ?? "sur.plus <no-reply@sur.plus>"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      error: await deliveryError(response),
      provider: "webhook",
      status: "failed"
    };
  }

  const body = (await response.json().catch(() => null)) as { id?: unknown; messageId?: unknown } | null;
  const id = typeof body?.messageId === "string" ? body.messageId : body?.id;

  return {
    messageId: typeof id === "string" ? id : null,
    provider: "webhook",
    status: "sent"
  };
}

async function deliveryError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  const detail = body ? `: ${body.slice(0, 180)}` : "";

  return `email_delivery_failed_${response.status}${detail}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

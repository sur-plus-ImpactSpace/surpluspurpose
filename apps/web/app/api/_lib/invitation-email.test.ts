import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverInvitationEmail } from "./invitation-email";

describe("deliverInvitationEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips delivery when no provider is configured", async () => {
    await expect(deliverInvitationEmail({ acceptanceUrl: "https://sur.plus/?invite=abc", invitation })).resolves.toEqual({
      provider: "not_configured",
      reason: "email_provider_not_configured",
      status: "skipped"
    });
  });

  it("sends invitation emails through Resend when configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "resend-key");
    vi.stubEnv("SURPLUS_INVITE_FROM_EMAIL", "sur.plus <invites@sur.plus>");
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      expect(args[0]).toBe("https://api.resend.com/emails");

      return Response.json({ id: "email-123" });
    });

    const delivery = await deliverInvitationEmail(
      {
        acceptanceUrl: "https://sur.plus/?invite=abc",
        invitation
      },
      fetchMock
    );

    expect(delivery).toEqual({
      messageId: "email-123",
      provider: "resend",
      status: "sent"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer resend-key",
          "content-type": "application/json"
        }
      })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      from: "sur.plus <invites@sur.plus>",
      subject: "Your sur.plus Corporate invite",
      to: ["ops@acme.example"]
    });
  });

  it("can use a generic invitation webhook", async () => {
    vi.stubEnv("SURPLUS_INVITE_WEBHOOK_URL", "https://email-worker.example/invite");
    vi.stubEnv("SURPLUS_INVITE_WEBHOOK_TOKEN", "worker-token");
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      expect(args[0]).toBe("https://email-worker.example/invite");

      return Response.json({ messageId: "worker-123" });
    });

    await expect(
      deliverInvitationEmail(
        {
          acceptanceUrl: "https://sur.plus/?invite=abc",
          invitation
        },
        fetchMock
      )
    ).resolves.toEqual({
      messageId: "worker-123",
      provider: "webhook",
      status: "sent"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://email-worker.example/invite",
      expect.objectContaining({
        headers: {
          authorization: "Bearer worker-token",
          "content-type": "application/json"
        }
      })
    );
  });
});

const invitation = {
  acceptedAt: null,
  acceptedBy: null,
  companyId: "co-acme",
  createdAt: "2026-06-26T10:00:00.000Z",
  email: "ops@acme.example",
  expiresAt: "2026-07-15",
  id: "inv-1",
  ngoId: null,
  orgName: "Acme GmbH",
  role: "corporate",
  status: "pending"
} as const;

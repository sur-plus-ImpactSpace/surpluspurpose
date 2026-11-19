import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown, key: string | null, actor = "usr-admin-ops") =>
  POST(
    new NextRequest("http://127.0.0.1:3000/api/signature-envelopes", {
      method: "POST",
      headers: { "content-type": "application/json", "x-surplus-preview-user-id": actor, ...(key ? { "idempotency-key": key } : {}) },
      body: JSON.stringify(body)
    })
  );

afterEach(() => vi.unstubAllEnvs());

describe("signature envelope route", () => {
  it("validates the request", async () => {
    expect((await post({ documentId: "doc-donation-certificate-thinkpads" }, null)).status).toBe(428);
    expect((await post({}, "s1")).status).toBe(422);
  });

  it("is for Ops only", async () => {
    expect((await post({ documentId: "doc-donation-certificate-thinkpads" }, "s2", "usr-corporate-acme")).status).toBe(403);
    expect((await post({ documentId: "doc-donation-certificate-thinkpads" }, "s3", "usr-ngo-kleiderkammer")).status).toBe(403);
  });

  it("only signs certificates that exist", async () => {
    expect((await post({ documentId: "nope" }, "s4")).status).toBe(404);
    const report = await post({ documentId: "doc-csrd-thinkpads" }, "s5");
    expect(report.status).toBe(422);
    await expect(report.json()).resolves.toEqual({ error: "not_signable" });
  });

  it("fails closed without a DocuSeal key", async () => {
    const response = await post({ documentId: "doc-donation-certificate-thinkpads" }, "s6");
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "esign_not_configured" });
  });

  it("will not send a certificate whose match has not been completed", async () => {
    vi.stubEnv("DOCUSEAL_API_KEY", "key");
    const response = await post({ documentId: "doc-donation-certificate-thinkpads" }, "s7");

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "document_not_ready" });
  });
});

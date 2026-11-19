import { afterEach, describe, expect, it, vi } from "vitest";
import { createSigningSubmission, docusealConfigFromEnv, isDocusealFileUrl, verifyDocusealWebhook } from "./docuseal";

afterEach(() => vi.unstubAllEnvs());

const headers = (values: Record<string, string>) => ({ get: (name: string) => values[name.toLowerCase()] ?? null });

describe("docusealConfigFromEnv", () => {
  it("fails closed without an API key and defaults to the cloud host", () => {
    expect(docusealConfigFromEnv()).toBeNull();
    vi.stubEnv("DOCUSEAL_API_KEY", "key");
    expect(docusealConfigFromEnv()).toEqual({ apiKey: "key", baseUrl: "https://api.docuseal.com" });
    vi.stubEnv("DOCUSEAL_URL", "https://sign.example.org/");
    expect(docusealConfigFromEnv()?.baseUrl).toBe("https://sign.example.org");
  });
});

describe("verifyDocusealWebhook", () => {
  it("refuses everything until a secret is configured", () => {
    expect(verifyDocusealWebhook(headers({ "x-docuseal-secret": "anything" }))).toBe(false);
  });

  it("accepts only the exact secret in the configured header", () => {
    vi.stubEnv("DOCUSEAL_WEBHOOK_SECRET", "s3cret");
    expect(verifyDocusealWebhook(headers({ "x-docuseal-secret": "s3cret" }))).toBe(true);
    expect(verifyDocusealWebhook(headers({ "x-docuseal-secret": "s3cret!" }))).toBe(false);
    expect(verifyDocusealWebhook(headers({ "x-docuseal-secret": "S3CRET" }))).toBe(false);
    expect(verifyDocusealWebhook(headers({}))).toBe(false);
    vi.stubEnv("DOCUSEAL_WEBHOOK_HEADER", "x-custom");
    expect(verifyDocusealWebhook(headers({ "x-custom": "s3cret" }))).toBe(true);
    expect(verifyDocusealWebhook(headers({ "x-docuseal-secret": "s3cret" }))).toBe(false);
  });
});

describe("isDocusealFileUrl", () => {
  it("accepts DocuSeal's own hosts over https and nothing else", () => {
    expect(isDocusealFileUrl("https://docuseal.com/file/abc/doc.pdf")).toBe(true);
    expect(isDocusealFileUrl("https://cdn.docuseal.eu/x.pdf")).toBe(true);
    for (const url of ["http://docuseal.com/x.pdf", "https://evil.example/x.pdf", "https://docuseal.com.evil.example/x.pdf", "https://169.254.169.254/x", "ftp://docuseal.com/x", "not a url", 42, null]) {
      expect(isDocusealFileUrl(url), String(url)).toBe(false);
    }
  });

  it("honours a self-hosted install and extra file hosts", () => {
    vi.stubEnv("DOCUSEAL_URL", "https://sign.example.org");
    vi.stubEnv("DOCUSEAL_FILE_HOSTS", "files.example.org, other.test");
    expect(isDocusealFileUrl("https://sign.example.org/file/x.pdf")).toBe(true);
    expect(isDocusealFileUrl("https://files.example.org/x.pdf")).toBe(true);
    expect(isDocusealFileUrl("https://other.test/x.pdf")).toBe(true);
    expect(isDocusealFileUrl("https://elsewhere.test/x.pdf")).toBe(false);
  });
});

describe("createSigningSubmission", () => {
  const config = { apiKey: "key", baseUrl: "https://api.docuseal.com" };
  const request = { name: "Cert", html: "<p>x</p>", company: { name: "Acme", email: "a@acme.de" }, ngo: { name: "NGO", email: "n@ngo.org" } };

  it("creates a template from the HTML, then a submission with both roles", async () => {
    const calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, auth: new Headers(init?.headers).get("x-auth-token"), body: JSON.parse(String(init?.body)) });

      return Response.json(url.endsWith("/templates/html") ? { id: 7 } : [{ submission_id: 99, role: "Company" }, { submission_id: 99, role: "NGO" }]);
    });

    expect(await createSigningSubmission(config, request, fetchImpl as unknown as typeof fetch)).toEqual({ externalId: "99" });
    expect(calls.map((call) => call.url)).toEqual(["https://api.docuseal.com/templates/html", "https://api.docuseal.com/submissions"]);
    expect(calls.every((call) => call.auth === "key")).toBe(true);
    expect(calls[0]?.body).toMatchObject({ html: "<p>x</p>", size: "A4" });
    expect(calls[1]?.body).toMatchObject({
      template_id: 7,
      send_email: true,
      submitters: [{ role: "Company", email: "a@acme.de" }, { role: "NGO", email: "n@ngo.org" }]
    });
  });

  it("reports DocuSeal trouble without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing = (async () => new Response("no", { status: 500 })) as unknown as typeof fetch;
    const noId = (async () => Response.json({})) as unknown as typeof fetch;

    expect(await createSigningSubmission(config, request, failing)).toEqual({ error: "esign_unavailable" });
    expect(await createSigningSubmission(config, request, noId)).toEqual({ error: "esign_unavailable" });
  });
});

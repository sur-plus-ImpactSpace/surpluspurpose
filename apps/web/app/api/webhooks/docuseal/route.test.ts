import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const hook = (payload: unknown, secret: string | null = "s3cret") =>
  new NextRequest("http://127.0.0.1:3000/api/webhooks/docuseal", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-docuseal-secret": secret } : {}) },
    body: JSON.stringify(payload)
  });

function supabaseEnv() {
  vi.stubEnv("DOCUSEAL_WEBHOOK_SECRET", "s3cret");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("docuseal webhook", () => {
  it("refuses a request without the right secret and changes nothing", async () => {
    supabaseEnv();
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }]));
    vi.stubGlobal("fetch", fetchMock);

    expect((await POST(hook({ event_type: "submission.completed", data: { id: 1 } }, null))).status).toBe(401);
    expect((await POST(hook({ event_type: "submission.completed", data: { id: 1 } }, "wrong"))).status).toBe(401);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("apply_docuseal_event"))).toBe(false);
  });

  it("refuses everything when no secret is configured", async () => {
    expect((await POST(hook({ event_type: "submission.completed", data: { id: 1 } }))).status).toBe(401);
  });

  it("applies a signer's completion through the service role", async () => {
    supabaseEnv();
    const calls: Array<{ url: string; auth: string | null; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body ?? "{}")) });
        if (url.includes("reserve_rate_limit")) return Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }]);

        return Response.json("partially_signed");
      })
    );

    const response = await POST(hook({ event_type: "form.completed", data: { email: "A@Acme.de", submission: { id: 99 } } }));

    expect(response.status).toBe(200);
    const apply = calls.find((call) => call.url.includes("apply_docuseal_event"));
    expect(apply?.auth).toBe("Bearer service-key");
    expect(apply?.body).toMatchObject({ p_external_id: "99", p_event: "signed", p_email: "A@Acme.de" });
  });

  it("stores the signed copy from DocuSeal's own host before completing", async () => {
    supabaseEnv();
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("reserve_rate_limit")) return Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }]);
        if (url.startsWith("https://docuseal.com/")) return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 });
        if (url.includes("/storage/v1/object/signed-documents/")) return Response.json({ Key: "ok" });
        if (url.includes("apply_docuseal_event")) {
          expect(JSON.parse(String(init?.body))).toMatchObject({ p_event: "completed", p_signed_path: "99.pdf" });

          return Response.json("completed");
        }

        return Response.json([]);
      })
    );

    const response = await POST(hook({ event_type: "submission.completed", data: { id: 99, documents: [{ url: "https://docuseal.com/file/x/doc.pdf" }] } }));

    expect(response.status).toBe(200);
    expect(calls.some((url) => url.includes("/storage/v1/object/signed-documents/99.pdf"))).toBe(true);
  });

  it("never fetches a signed-copy URL outside DocuSeal, but still completes the envelope", async () => {
    supabaseEnv();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
        const url = String(input);
        calls.push(url);
        if (url.includes("reserve_rate_limit")) return Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }]);
        if (url.includes("apply_docuseal_event")) {
          expect(JSON.parse(String(init?.body)).p_signed_path).toBeNull();

          return Response.json("completed");
        }

        return Response.json([]);
      })
    );

    const response = await POST(hook({ event_type: "submission.completed", data: { id: 5, documents: [{ url: "https://169.254.169.254/latest" }] } }));

    expect(response.status).toBe(200);
    expect(calls.some((url) => url.includes("169.254"))).toBe(false);
  });

  it("acknowledges events it does not use, and answers 503 on a database failure so DocuSeal retries", async () => {
    supabaseEnv();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) =>
        String(input).includes("reserve_rate_limit")
          ? Response.json([{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 1000).toISOString() }])
          : new Response("db down", { status: 500 })
      )
    );

    expect(await (await POST(hook({ event_type: "template.created", data: {} }))).json()).toMatchObject({ ignored: true });
    expect((await POST(hook({ event_type: "form.completed", data: { email: "a@b.c", submission: { id: 1 } } }))).status).toBe(503);
  });
});

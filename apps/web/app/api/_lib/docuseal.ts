import { timingSafeEqual } from "node:crypto";

export type DocusealConfig = { apiKey: string; baseUrl: string };

/** No API key, no e-signature: it fails closed rather than pretending to sign. */
export function docusealConfigFromEnv(): DocusealConfig | null {
  const apiKey = process.env.DOCUSEAL_API_KEY;
  if (!apiKey) return null;

  return { apiKey, baseUrl: (process.env.DOCUSEAL_URL ?? "https://api.docuseal.com").replace(/\/+$/, "") };
}

export type SigningRequest = {
  name: string;
  /** Certificate HTML carrying one <signature-field role="Company"> and one role="NGO". */
  html: string;
  company: { name: string; email: string };
  ngo: { name: string; email: string };
};

/**
 * Create the signing request at DocuSeal: a template from the certificate HTML,
 * then a submission with the two signers. The submission id is what the webhook
 * later reports, so it is the envelope's external id. DocuSeal emails the signers.
 */
export async function createSigningSubmission(
  config: DocusealConfig,
  request: SigningRequest,
  fetchImpl: typeof fetch = fetch
): Promise<{ externalId: string } | { error: "esign_unavailable" }> {
  const call = async (path: string, body: unknown) => {
    const response = await fetchImpl(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: { "X-Auth-Token": config.apiKey, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`docuseal ${path} ${response.status}`);

    return (await response.json()) as unknown;
  };

  try {
    const template = (await call("/templates/html", { html: request.html, name: request.name, size: "A4" })) as { id?: unknown };
    if (typeof template.id !== "number") return { error: "esign_unavailable" };

    // The role names must match the role attributes in the HTML.
    const submitters = (await call("/submissions", {
      template_id: template.id,
      send_email: true,
      submitters: [
        { role: "Company", name: request.company.name, email: request.company.email },
        { role: "NGO", name: request.ngo.name, email: request.ngo.email }
      ]
    })) as Array<{ submission_id?: unknown }>;
    const submissionId = submitters[0]?.submission_id;
    if (typeof submissionId !== "number" && typeof submissionId !== "string") return { error: "esign_unavailable" };

    return { externalId: String(submissionId) };
  } catch (error) {
    console.error("DocuSeal request failed", error);

    return { error: "esign_unavailable" };
  }
}

/**
 * DocuSeal does not sign its webhooks; it can send a custom header with every
 * request. Configure that header in DocuSeal (name in DOCUSEAL_WEBHOOK_HEADER,
 * default x-docuseal-secret) and its value in DOCUSEAL_WEBHOOK_SECRET. Compared
 * in constant time; no secret configured means every request is refused.
 */
export function verifyDocusealWebhook(headers: { get(name: string): string | null }): boolean {
  const secret = process.env.DOCUSEAL_WEBHOOK_SECRET;
  if (!secret) return false;
  const received = headers.get(process.env.DOCUSEAL_WEBHOOK_HEADER ?? "x-docuseal-secret");
  if (!received) return false;

  const a = Buffer.from(received);
  const b = Buffer.from(secret);

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The signed copy is fetched from a URL inside the webhook payload, so only
 * DocuSeal's own hosts qualify (plus any listed in DOCUSEAL_FILE_HOSTS for a
 * self-hosted install). Never an arbitrary address.
 */
export function isDocusealFileUrl(rawUrl: unknown): rawUrl is string {
  if (typeof rawUrl !== "string") return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    const own = new URL(process.env.DOCUSEAL_URL ?? "https://api.docuseal.com").hostname;
    const allowed = [
      "docuseal.com",
      "docuseal.eu",
      own,
      ...(process.env.DOCUSEAL_FILE_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean)
    ];

    return allowed.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

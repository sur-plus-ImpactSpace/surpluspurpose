import { isFreemailEmail } from "./freemail";

/**
 * Automatic company check (ADR 0027 C3): VAT ID in VIES, a company email
 * domain and a reachable website. All three pass -> approved without a human;
 * anything else -> Ops reviews manually. Mirrors record_company_check (0044).
 */
export type CompanyCheckResult = {
  vatOk: boolean;
  vatName: string | null;
  domainOk: boolean;
  websiteOk: boolean;
};

export type CompanyCheckOutcome = "approved" | "manual_review";

export function decideCompanyCheck(result: Pick<CompanyCheckResult, "vatOk" | "domainOk" | "websiteOk">): CompanyCheckOutcome {
  return result.vatOk && result.domainOk && result.websiteOk ? "approved" : "manual_review";
}

/** The contact email must be on a company domain: kostenlose Freemail-Adressen are not enough. */
export function isCompanyEmailDomain(email: string): boolean {
  return email.includes("@") && !isFreemailEmail(email);
}

export type ParsedVatId = { countryCode: string; number: string; normalized: string };

/** Shape check only (country prefix + 2-12 alphanumerics); VIES decides validity. */
export function parseVatId(raw: string): ParsedVatId | null {
  const compact = raw.replace(/[\s.-]/g, "").toUpperCase();
  const match = /^([A-Z]{2})([0-9A-Z]{2,12})$/.exec(compact);
  // Every EU VAT number carries digits; this keeps words like "nope" out.
  if (!match || (match[2]!.match(/\d/g) ?? []).length < 2) return null;

  return { countryCode: match[1]!, number: match[2]!, normalized: compact };
}

export type CompanyCheckCommand = {
  idempotencyKey: string;
  companyId: string;
  vatId: string;
  website: string;
};

export type CompanyCheckCommandErrorReason =
  | "missing_idempotency_key"
  | "invalid_company_id"
  | "invalid_payload"
  | "invalid_vat_id"
  | "invalid_website";

export type CompanyCheckCommandResult =
  | { ok: true; command: CompanyCheckCommand }
  | { ok: false; reason: CompanyCheckCommandErrorReason; status: 400 | 422 | 428 };

/** Pure shape check of the "verify my company" form. The website must be an http(s) URL. */
export function parseCompanyCheckCommand(
  headers: { get(name: string): string | null },
  companyId: unknown,
  body: unknown
): CompanyCheckCommandResult {
  const idempotencyKey = headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return { ok: false, reason: "missing_idempotency_key", status: 428 };
  if (typeof companyId !== "string" || !companyId.trim()) return { ok: false, reason: "invalid_company_id", status: 422 };
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, reason: "invalid_payload", status: 400 };
  }

  const { vatId, website } = body as Record<string, unknown>;
  const vat = typeof vatId === "string" ? parseVatId(vatId) : null;
  if (!vat) return { ok: false, reason: "invalid_vat_id", status: 422 };

  const url = parseWebsite(website);
  if (!url || !["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.href.length > 300) {
    return { ok: false, reason: "invalid_website", status: 422 };
  }

  return {
    ok: true,
    command: { idempotencyKey, companyId: companyId.trim(), vatId: vat.normalized, website: url.href }
  };
}

function parseWebsite(website: unknown): URL | null {
  const candidate = typeof website === "string" ? website.trim() : "";
  try {
    return new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  } catch {
    return null;
  }
}

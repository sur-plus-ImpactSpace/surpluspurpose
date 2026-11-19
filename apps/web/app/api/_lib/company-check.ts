import { isCompanyEmailDomain, parseVatId, type CompanyCheckResult } from "@surplus/domain";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const VIES = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const TIMEOUT_MS = 6000;

export type CompanyCheckDeps = {
  fetchImpl?: typeof fetch;
  resolve?: (hostname: string) => Promise<string[]>;
};

/**
 * Network checks for the automatic company check (ADR 0027 C3). Any failure,
 * timeout or doubt makes a check false, which sends the company to a human in
 * the Ops queue, never to an automatic approval.
 */
export async function runCompanyCheck(
  input: { vatId: string; website: string; contactEmail: string },
  deps: CompanyCheckDeps = {}
): Promise<CompanyCheckResult> {
  const [vat, websiteOk] = await Promise.all([
    checkVatId(input.vatId, deps.fetchImpl ?? fetch),
    checkWebsite(input.website, deps)
  ]);

  return {
    vatOk: vat.valid,
    vatName: vat.name,
    domainOk: isCompanyEmailDomain(input.contactEmail),
    websiteOk
  };
}

async function checkVatId(raw: string, fetchImpl: typeof fetch): Promise<{ valid: boolean; name: string | null }> {
  const vat = parseVatId(raw);
  if (!vat) return { valid: false, name: null };

  try {
    // VIES calls Greece "EL"; the number goes in the path, so keep it strictly alphanumeric.
    const response = await fetchImpl(`${VIES}/${vat.countryCode}/vat/${encodeURIComponent(vat.number)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) return { valid: false, name: null };
    const body = (await response.json()) as { isValid?: unknown; valid?: unknown; name?: unknown };
    const valid = body.isValid === true || body.valid === true;

    return { valid, name: valid && typeof body.name === "string" && body.name !== "---" ? body.name : null };
  } catch {
    return { valid: false, name: null };
  }
}

async function checkWebsite(rawUrl: string, deps: CompanyCheckDeps): Promise<boolean> {
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (!(await isPublicHost(url.hostname, deps.resolve ?? resolveAddresses))) return false;

    // Redirects are not followed: a redirect target would skip the host check above.
    const response = await (deps.fetchImpl ?? fetch)(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    return response.status < 400;
  } catch {
    return false;
  }
}

async function resolveAddresses(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true });

  return records.map((record) => record.address);
}

/** The user chose this URL, so never let the server be pointed at its own network. */
export async function isPublicHost(hostname: string, resolve: (hostname: string) => Promise<string[]>): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return false;
  }

  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (addresses.length === 0) return false;

  return addresses.every((address) => !isPrivateAddress(address));
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::" || lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) {
      return true;
    }
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);

    return mapped ? isPrivateAddress(mapped[1]!) : false;
  }

  const [a = 0, b = 0] = address.split(".").map(Number);

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

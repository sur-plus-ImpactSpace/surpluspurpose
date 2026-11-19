import { describe, expect, it, vi } from "vitest";
import { isPublicHost, runCompanyCheck } from "./company-check";

const publicDns = async () => ["93.184.216.34"];
const viesOk = (valid: boolean) => vi.fn(async (input: URL | RequestInfo) => {
  const url = String(input);
  if (url.includes("/vies/")) return Response.json({ isValid: valid, name: "ACME GMBH" });

  return new Response("<html></html>", { status: 200 });
});

describe("runCompanyCheck", () => {
  const input = { vatId: "DE123456789", website: "https://acme-gmbh.de/", contactEmail: "lea@acme-gmbh.de" };

  it("passes all three checks for a real company", async () => {
    expect(await runCompanyCheck(input, { fetchImpl: viesOk(true), resolve: publicDns })).toEqual({
      vatOk: true,
      vatName: "ACME GMBH",
      domainOk: true,
      websiteOk: true
    });
  });

  it("fails the VAT check for an invalid number and for a VIES outage", async () => {
    expect((await runCompanyCheck(input, { fetchImpl: viesOk(false), resolve: publicDns })).vatOk).toBe(false);
    const down = vi.fn(async (url: URL | RequestInfo) =>
      String(url).includes("/vies/") ? new Response("", { status: 503 }) : new Response("", { status: 200 })
    );
    expect((await runCompanyCheck(input, { fetchImpl: down, resolve: publicDns })).vatOk).toBe(false);
  });

  it("fails the domain check for freemail", async () => {
    const result = await runCompanyCheck({ ...input, contactEmail: "lea@gmail.com" }, { fetchImpl: viesOk(true), resolve: publicDns });
    expect(result.domainOk).toBe(false);
  });

  it("fails the website check for an error page or an unreachable site", async () => {
    const broken = vi.fn(async (url: URL | RequestInfo) =>
      String(url).includes("/vies/") ? Response.json({ isValid: true }) : new Response("", { status: 404 })
    );
    expect((await runCompanyCheck(input, { fetchImpl: broken, resolve: publicDns })).websiteOk).toBe(false);
    const throws = vi.fn(async (url: URL | RequestInfo) => {
      if (String(url).includes("/vies/")) return Response.json({ isValid: true });
      throw new Error("ECONNREFUSED");
    });
    expect((await runCompanyCheck(input, { fetchImpl: throws, resolve: publicDns })).websiteOk).toBe(false);
  });

  it("never fetches a website that points at the server's own network", async () => {
    const fetchImpl = viesOk(true);
    const result = await runCompanyCheck(
      { ...input, website: "http://169.254.169.254/latest/meta-data" },
      { fetchImpl, resolve: publicDns }
    );

    expect(result.websiteOk).toBe(false);
    expect(fetchImpl.mock.calls.every(([url]) => String(url).includes("/vies/"))).toBe(true);
  });
});

describe("isPublicHost", () => {
  it("rejects loopback, private and link-local targets, however they are written", async () => {
    for (const host of ["localhost", "app.localhost", "127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "[::1]", "::ffff:127.0.0.1", "fd00::1", "metadata.internal"]) {
      expect(await isPublicHost(host, publicDns), host).toBe(false);
    }
  });

  it("rejects a name that resolves to a private address or does not resolve", async () => {
    expect(await isPublicHost("evil.example", async () => ["10.1.2.3"])).toBe(false);
    expect(await isPublicHost("evil.example", async () => ["93.184.216.34", "127.0.0.1"])).toBe(false);
    expect(await isPublicHost("nowhere.example", async () => { throw new Error("ENOTFOUND"); })).toBe(false);
  });

  it("accepts a public address", async () => {
    expect(await isPublicHost("acme-gmbh.de", publicDns)).toBe(true);
    expect(await isPublicHost("93.184.216.34", publicDns)).toBe(true);
  });
});

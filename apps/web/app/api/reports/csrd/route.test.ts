import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const get = (query: string, actor = "usr-corporate-acme") =>
  GET(new NextRequest(`http://127.0.0.1:3000/api/reports/csrd${query}`, { headers: { "x-surplus-preview-user-id": actor } }));

describe("CSRD report export route", () => {
  it("refuses a malformed period or format before anything else", async () => {
    expect((await get("?from=2026-13-40")).status).toBe(422);
    expect((await get("?from=2026-05-01&to=2026-01-01")).status).toBe(422);
    const format = await get("?format=pdf");
    expect(format.status).toBe(422);
    await expect(format.json()).resolves.toEqual({ error: "invalid_format" });
  });

  it("is for companies only", async () => {
    expect((await get("", "usr-ngo-kleiderkammer")).status).toBe(403);
    expect((await get("", "usr-admin-ops")).status).toBe(403);
  });

  it("downloads the report as an HTML file for a verified company", async () => {
    const response = await get("?from=2026-01-01&to=2026-12-31");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-disposition")).toContain("sustainability-report_2026-01-01_2026-12-31.html");
    const html = await response.text();
    expect(html).toContain("Acme GmbH");
    expect(html).toContain("2026-01-01 to 2026-12-31");
  });

  it("offers the same data as CSV", async () => {
    const response = await get("?format=csv");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect((await response.text()).startsWith("date,match_id,goods")).toBe(true);
  });
});

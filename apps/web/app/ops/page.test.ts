import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sur.plus Ops entry route", () => {
  it("keeps /ops as the explicit admin preview entry", () => {
    const opsPage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const appPage = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");
    const dictionary = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

    expect(opsPage).toContain('role: "admin"');
    expect(opsPage).toContain('requiredRole: "admin"');
    expect(opsPage).toContain('import Home from "../page"');
    expect(appPage).toContain('href={item.role === "admin" ? "/ops" : `/?role=${item.role}`}');
    // The access-boundary copy now lives in the dictionary (EN/DE), not inline.
    expect(dictionary).toContain("The URL does not grant additional permissions.");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("sur.plus Ops bootstrap page", () => {
  it("keeps admin bootstrap behind session auth and the bootstrap token header", () => {
    const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const panel = readFileSync(new URL("../../components/AdminBootstrapPanel.tsx", import.meta.url), "utf8");

    expect(page).toContain("AdminBootstrapPanel");
    expect(page).toContain("AuthSessionControls");
    expect(panel).toContain("supabase.auth.getSession()");
    expect(panel).toContain('fetch("/api/admin/bootstrap"');
    expect(panel).toContain('"x-surplus-bootstrap-token": bootstrapToken.trim()');
    expect(panel).toContain('setBootstrapToken("")');
  });
});

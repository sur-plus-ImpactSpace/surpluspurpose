import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_MAX_SANDBOXES,
  DEMO_TTL_MS,
  clearSandboxes,
  createSandbox,
  getSandbox,
  isSandboxId,
  pruneSandboxes,
  sandboxCount
} from "./demo-sandbox";

const admin = { role: "admin", userId: "usr-admin-ops" } as const;

beforeEach(() => clearSandboxes());

describe("demo sandboxes", () => {
  it("gives every visitor their own seeded workspace", () => {
    const a = createSandbox();
    const b = createSandbox();

    expect(a.id).not.toBe(b.id);
    expect(a.sandbox.repository.matches.list(admin).length).toBeGreaterThan(0);
    a.sandbox.repository.matches.transition("mat-jackets", "cancelled", admin);

    expect(a.sandbox.repository.matches.get("mat-jackets")?.state).toBe("cancelled");
    expect(b.sandbox.repository.matches.get("mat-jackets")?.state).toBe("both_confirmed");
  });

  it("returns the same sandbox, with its changes, for the same visitor", () => {
    const { id, sandbox } = createSandbox();
    sandbox.repository.matches.transition("mat-jackets", "cancelled", admin);

    expect(getSandbox(id)?.repository.matches.get("mat-jackets")?.state).toBe("cancelled");
  });

  it("refuses malformed, unknown and forged ids", () => {
    createSandbox();

    for (const id of [undefined, null, "", "../../etc", "not-a-uuid", "00000000-0000-4000-8000-000000000000", 42]) {
      expect(getSandbox(id), String(id)).toBeUndefined();
    }
    expect(isSandboxId(crypto.randomUUID())).toBe(true);
    expect(isSandboxId("1".repeat(36))).toBe(false);
  });

  it("cleans up a sandbox that has been idle past the TTL", () => {
    const start = 1_000_000;
    const { id } = createSandbox(start);

    expect(getSandbox(id, start + DEMO_TTL_MS - 1)).toBeDefined();
    expect(getSandbox(id, start + DEMO_TTL_MS - 1 + DEMO_TTL_MS + 1)).toBeUndefined();
    expect(sandboxCount()).toBe(0);
  });

  it("keeps a sandbox alive while it is in use", () => {
    const start = 1_000_000;
    const { id } = createSandbox(start);
    for (let step = 1; step <= 5; step += 1) expect(getSandbox(id, start + step * (DEMO_TTL_MS - 1000))).toBeDefined();
  });

  it("prunes on demand and reports what it removed", () => {
    const start = 1_000_000;
    createSandbox(start);
    createSandbox(start);

    expect(pruneSandboxes(start + DEMO_TTL_MS + 1)).toBe(2);
    expect(pruneSandboxes(start + DEMO_TTL_MS + 1)).toBe(0);
  });

  it("caps the number of sandboxes by dropping the oldest", () => {
    const first = createSandbox(1);
    for (let index = 0; index < DEMO_MAX_SANDBOXES; index += 1) createSandbox(2 + index);

    expect(sandboxCount()).toBe(DEMO_MAX_SANDBOXES);
    expect(getSandbox(first.id, 10_000)).toBeUndefined();
  });
});

import { createInMemoryRepository, createSeedData, type RepositoryData, type SurplusRepository } from "@surplus/domain";

/**
 * Per-visitor demo sandboxes. Each visitor who enters the demo gets their own
 * seeded workspace behind a cookie, so what one person approves, confirms or
 * posts never shows up for another. Sandboxes live in this server's memory and
 * are cleaned up lazily: one idle for longer than the TTL is dropped, and the
 * oldest go first if too many accumulate. There is no timer to forget.
 */
export const DEMO_COOKIE = "sp_demo";
export const DEMO_TTL_MS = 2 * 60 * 60 * 1000;
export const DEMO_MAX_SANDBOXES = 500;

export type DemoSandbox = { data: RepositoryData; repository: SurplusRepository };

type Entry = DemoSandbox & { lastUsed: number };

// Held on globalThis: the route handler that creates a sandbox and the page that
// reads it can load this module separately (Next dev, split bundles), and a plain
// module-level Map would then be two different stores.
const globalStore = globalThis as typeof globalThis & { __surplusDemoSandboxes?: Map<string, Entry> };
const sandboxes = (globalStore.__surplusDemoSandboxes ??= new Map<string, Entry>());
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isSandboxId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

/** Drop idle sandboxes, then the oldest ones beyond the cap. Returns how many went. */
export function pruneSandboxes(now = Date.now()): number {
  let removed = 0;
  for (const [id, entry] of sandboxes) {
    if (now - entry.lastUsed > DEMO_TTL_MS) {
      sandboxes.delete(id);
      removed += 1;
    }
  }
  if (sandboxes.size > DEMO_MAX_SANDBOXES) {
    const oldest = [...sandboxes.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [id] of oldest.slice(0, sandboxes.size - DEMO_MAX_SANDBOXES)) {
      sandboxes.delete(id);
      removed += 1;
    }
  }

  return removed;
}

/** A fresh seeded sandbox for a new visitor. */
export function createSandbox(now = Date.now()): { id: string; sandbox: DemoSandbox } {
  pruneSandboxes(now);
  const id = crypto.randomUUID();
  const data = createSeedData();
  const sandbox = { data, repository: createInMemoryRepository(data) };
  sandboxes.set(id, { ...sandbox, lastUsed: now });
  // Make room for the new one if the cap was reached.
  pruneSandboxes(now);

  return { id, sandbox };
}

/** The visitor's sandbox, or undefined if the id is malformed, unknown or expired. Using it keeps it alive. */
export function getSandbox(id: unknown, now = Date.now()): DemoSandbox | undefined {
  if (!isSandboxId(id)) return undefined;
  pruneSandboxes(now);
  const entry = sandboxes.get(id);
  if (!entry) return undefined;
  entry.lastUsed = now;

  return { data: entry.data, repository: entry.repository };
}

export function sandboxCount(): number {
  return sandboxes.size;
}

/** Test helper. */
export function clearSandboxes(): void {
  sandboxes.clear();
}

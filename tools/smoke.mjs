#!/usr/bin/env node
/**
 * HTTP smoke test for the sur.plus web app (demo/preview mode, no Supabase env).
 *
 * Covers the customer loop surface without a browser: redirects, demo entry
 * (POST /demo/enter → sandbox cookie), roles, plan preview, legal pages, API
 * guards and the document trust gate.
 *
 * Usage:
 *   Against a running server:  BASE_URL=http://localhost:3000 node tools/smoke.mjs
 *   Self-managed (CI/local):   node tools/smoke.mjs --start
 *     (builds are NOT triggered; run `pnpm --filter @surplus/web build` first)
 */
import { spawn } from "node:child_process";

const SELF_START = process.argv.includes("--start");
const PORT = process.env.SMOKE_PORT ?? "3100";
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;

let server = null;
let failures = 0;

function ok(name, condition, detail = "") {
  const line = condition ? `ok    ${name}` : `NOT OK ${name} ${detail}`;
  if (!condition) failures++;
  console.log(line);
}

async function get(path, init = {}) {
  return fetch(`${BASE}${path}`, { redirect: "manual", ...init });
}

/** Cookie jar for the private demo sandbox issued by POST /demo/enter. */
function readSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    const list = headers.getSetCookie();
    if (list.length > 0) return list;
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((value) => value.split(";", 1)[0])
    .filter(Boolean)
    .join("; ");
}

async function enterDemo(fields = {}) {
  const body = new URLSearchParams({ role: "corporate", ...fields });
  const response = await fetch(`${BASE}/demo/enter`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const cookie = cookieHeader(readSetCookies(response.headers));
  return { response, cookie };
}

async function getDemo(path, cookie) {
  return get(path, { headers: cookie ? { cookie } : {} });
}

async function waitForServer(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      await fetch(BASE, { redirect: "manual" });
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function run() {
  // Root + login redirect into the demo when no auth backend is configured.
  const root = await get("/");
  ok("/ redirects to /demo", [307, 308].includes(root.status) && (root.headers.get("location") ?? "").includes("/demo"), `got ${root.status}`);

  const login = await get("/login");
  ok("/login redirects to /demo (no Supabase env)", [307, 308].includes(login.status) && (login.headers.get("location") ?? "").includes("/demo"), `got ${login.status}`);

  // Enter once: allocate a private sandbox cookie, then hit the workspace views.
  // (Bare /demo without a cookie soft-redirects to /demo/start via the App Router —
  // not always a raw HTTP 307 — so the enter step is the reliable gate.)
  const { response: entered, cookie } = await enterDemo();
  ok(
    "POST /demo/enter issues a sandbox cookie",
    [303, 307, 308].includes(entered.status) && cookie.includes("sp_demo="),
    `got ${entered.status} cookie=${cookie ? "yes" : "no"}`
  );

  const demo = await (await getDemo("/demo", cookie)).text();
  ok("/demo renders corporate view", demo.includes("Demo workspace") || demo.includes("DEMO WORKSPACE") || demo.includes("Turn surplus into documented impact"));
  ok("/demo shows sandbox honesty note", demo.includes("This is not your data"));

  const ngo = await (await getDemo("/demo?role=ngo", cookie)).text();
  ok("/demo?role=ngo renders NGO view", ngo.includes("Receive verified surplus"));

  const pulse = await (
    await getDemo("/demo?pt=IT%20surplus&pc=IT%20%26%20Electronics&pq=1&pv=50000", cookie)
  ).text();
  ok("pulse bridge injects the visitor's surplus", pulse.includes("From your Pulse assessment"));

  const tree = await (await getDemo("/demo?role=corporate&plan=tree", cookie)).text();
  ok("tree preview shows unlimited matches", tree.includes("Unlimited"));
  ok("tree preview flags the plan", tree.includes("Your plan is Seed"));

  // Legal pages with the current address.
  const imprint = await (await get("/imprint")).text();
  ok("/imprint renders with address", imprint.includes("Landsberger Stra") && imprint.includes("82266 Inning"));
  const privacy = await (await get("/privacy")).text();
  ok("/privacy renders", privacy.includes("Privacy policy") && privacy.includes("Supabase authentication session"));

  // API guards.
  const noKey = await get("/api/listings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  ok("listing create without idempotency key → 428", noKey.status === 428, `got ${noKey.status}`);

  // Document trust gate: seed certificate hangs on a `proposed` match → 409.
  const gated = await get("/api/documents/doc-donation-certificate-thinkpads/download?actor=usr-corporate-acme");
  ok("certificate blocked before contact unlock → 409", gated.status === 409, `got ${gated.status}`);

  const unknownDoc = await get("/api/documents/doc-nope/download?actor=usr-corporate-acme");
  ok("unknown document → 404", unknownDoc.status === 404, `got ${unknownDoc.status}`);

  console.log(failures === 0 ? "\nSMOKE PASSED" : `\nSMOKE FAILED: ${failures} check(s)`);
  process.exitCode = failures === 0 ? 0 : 1;
}

async function main() {
  if (SELF_START) {
    // Demo/preview mode only. Blank Supabase keys so a developer’s apps/web/.env.local
    // cannot flip the smoke server into the authenticated runtime (Next does not
    // overwrite existing process.env from .env files).
    server = spawn("pnpm", ["--filter", "@surplus/web", "exec", "next", "start", "-p", PORT], {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SURPLUS_DEMO_ACCESS_TOKEN: ""
      }
    });
  }
  const up = await waitForServer();
  if (!up) {
    console.error(`Server not reachable at ${BASE}`);
    process.exitCode = 1;
  } else {
    await run();
  }
  if (server) server.kill("SIGTERM");
}

await main();

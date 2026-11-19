import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { DEMO_COOKIE, clearSandboxes, createSandbox } from "../../lib/demo-sandbox";
import { POST as transition } from "../matches/[matchId]/transition/route";

const call = (cookie: string | null, matchId = "mat-thinkpads") =>
  transition(
    new NextRequest(`http://127.0.0.1:3000/api/matches/${matchId}/transition`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-surplus-preview-user-id": "usr-ngo-kleiderkammer",
        "idempotency-key": `demo-${Math.random()}`,
        ...(cookie ? { cookie: `${DEMO_COOKIE}=${cookie}` } : {})
      },
      body: JSON.stringify({ nextState: "ngo_confirmed" })
    }),
    { params: Promise.resolve({ matchId }) }
  );

beforeEach(() => clearSandboxes());

describe("preview routes inside a demo sandbox", () => {
  it("act on the visitor's own sandbox, not on anybody else's", async () => {
    const mine = createSandbox();
    const theirs = createSandbox();

    const response = await call(mine.id);

    expect(response.status).toBe(200);
    expect(mine.sandbox.repository.matches.get("mat-thinkpads")?.state).toBe("ngo_confirmed");
    expect(theirs.sandbox.repository.matches.get("mat-thinkpads")?.state).toBe("proposed");
  });

  it("tell a visitor whose sandbox expired, instead of landing in shared data", async () => {
    const response = await call("00000000-0000-4000-8000-000000000001");

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ error: "demo_expired" });
  });

  it("treat a forged cookie like an expired one", async () => {
    expect((await call("../../etc/passwd")).status).toBe(410);
  });
});

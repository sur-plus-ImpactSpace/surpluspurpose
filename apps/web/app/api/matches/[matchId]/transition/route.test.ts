import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const NGO_USER = "usr-ngo-kleiderkammer";

describe("match transition route", () => {
  it("requires an idempotency key", async () => {
    const response = await POST(
      transitionRequest("mat-thinkpads", "ngo_confirmed", { idempotencyKey: null }),
      routeContext("mat-thinkpads")
    );
    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toEqual({ error: "missing_idempotency_key" });
  });

  it("blocks an actor that is not allowed to make the transition", async () => {
    // default preview actor is corporate; only the NGO can confirm proposed -> ngo_confirmed
    const response = await POST(
      transitionRequest("mat-thinkpads", "ngo_confirmed", { idempotencyKey: "route-test-not-allowed" }),
      routeContext("mat-thinkpads")
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "actor_not_allowed" });
  });

  it("rejects a transition that is not in the state machine", async () => {
    const response = await POST(
      transitionRequest("mat-thinkpads", "completed", {
        idempotencyKey: "route-test-invalid",
        actorId: NGO_USER
      }),
      routeContext("mat-thinkpads")
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "invalid_transition" });
  });

  it("advances the match on a valid actor-authorized transition (preview)", async () => {
    const response = await POST(
      transitionRequest("mat-thinkpads", "ngo_confirmed", {
        idempotencyKey: "route-test-confirm",
        actorId: NGO_USER
      }),
      routeContext("mat-thinkpads")
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      match: { id: "mat-thinkpads", state: "ngo_confirmed" },
      runtime: "preview-route-handler"
    });
  });
});

describe("match transition route, supabase runtime", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each([
    ["step_up_required", "the database wants an email step-up (ADR 0027 C5)"],
    ["org_not_verified", "the organisation is not verified (ADR 0027)"]
  ])("answers 403 %s when %s", async (reason) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        const url = String(input);
        if (url.includes("/auth/v1/user")) return Response.json({ id: "usr-ngo" });
        if (url.includes("/rest/v1/users")) {
          return Response.json([
            {
              id: "usr-ngo",
              email: "ngo@sur.plus.test",
              full_name: "NGO",
              role: "ngo",
              company_id: null,
              ngo_id: "ngo-1",
              created_at: "2026-06-24T10:00:00.000Z"
            }
          ]);
        }
        if (url.includes("/rest/v1/rpc/transition_match")) {
          return new Response(`{"message":"${reason}"}`, { status: 400 });
        }

        return Response.json([]);
      })
    );

    const request = new NextRequest("http://127.0.0.1:3000/api/matches/mat-1/transition", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer user-jwt",
        "idempotency-key": `route-test-${reason}`
      },
      body: JSON.stringify({ nextState: "completed" })
    });
    const response = await POST(request, routeContext("mat-1"));

    await expect(response.clone().json()).resolves.toEqual({ error: reason });
    expect(response.status).toBe(403);
  });
});

function transitionRequest(
  matchId: string,
  nextState: string,
  options: { idempotencyKey: string | null; actorId?: string } = { idempotencyKey: "route-test" }
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-surplus-preview-user-id": options.actorId ?? "usr-corporate-acme"
  };
  if (options.idempotencyKey) {
    headers["idempotency-key"] = options.idempotencyKey;
  }

  return new NextRequest(`http://127.0.0.1:3000/api/matches/${matchId}/transition`, {
    method: "POST",
    headers,
    body: JSON.stringify({ nextState })
  });
}

function routeContext(matchId: string) {
  return {
    params: Promise.resolve({
      matchId
    })
  };
}

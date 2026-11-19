import { describe, expect, it } from "vitest";
import { PLAN_ENTITLEMENTS, PLAN_TIERS, planAllows, type PlanTier } from "./model";
import { createInMemoryRepository, createSeedData, type ActorContext, type RepositoryData } from "./repository";

const acme: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };

function repoOnPlan(plan: PlanTier, change?: (data: RepositoryData) => void) {
  const data = createSeedData();
  const company = data.companies.find((item) => item.id === "co-acme");
  if (company) company.plan = plan;
  change?.(data);

  return createInMemoryRepository(data);
}

describe("plan limits: every gated feature, every plan", () => {
  it("social media cards are Tree only, on screen and on the server", () => {
    for (const plan of PLAN_TIERS) {
      const expected = plan === "tree";
      expect(planAllows(plan, "social_media_cards"), `${plan} (screen)`).toBe(expected);

      const result = repoOnPlan(plan).agentRuns.create(acme, { taskType: "social_ad", prompt: "Draft an impact card." });
      expect(result.ok, `${plan} (server)`).toBe(expected);
      if (!result.ok) expect(result.reason).toBe("plan_required");
    }
  });

  it("does not gate the other copilot tasks by plan", () => {
    for (const plan of PLAN_TIERS) {
      expect(repoOnPlan(plan).agentRuns.create(acme, { taskType: "message_draft", targetType: "match", targetId: "mat-thinkpads", prompt: "Draft a reply." }).ok).toBe(true);
    }
  });

  it("matching follows matches per year: none on registered, a cap on Seed, open on Tree", () => {
    const confirm = (plan: PlanTier, committed: number) => {
      const repo = repoOnPlan(plan, (data) => {
        const match = data.matches.find((item) => item.id === "mat-thinkpads");
        if (match) match.state = "ngo_confirmed";
        const template = data.matches.find((item) => item.id === "mat-jackets");
        for (let index = 0; index < committed && template; index += 1) {
          data.matches.push({
            ...template,
            id: `mat-old-${index}`,
            listingId: "lst-thinkpads",
            needId: "need-laptops",
            state: "completed",
            committedAt: "2026-02-01T00:00:00.000Z"
          });
        }
      });

      return repo.matches.transition("mat-thinkpads", "both_confirmed", acme);
    };

    expect(PLAN_ENTITLEMENTS.registered.matchesPerYear).toBe(0);
    expect(confirm("registered", 0)).toMatchObject({ ok: false, reason: "match_quota_exceeded" });
    expect(confirm("seed", 11).ok).toBe(true);
    expect(confirm("seed", 12)).toMatchObject({ ok: false, reason: "match_quota_exceeded" });
    expect(confirm("tree", 40).ok).toBe(true);
  });

  it("seats follow the plan, and removing a colleague frees one", () => {
    for (const plan of ["registered", "seed", "tree"] as const) {
      const limit = PLAN_ENTITLEMENTS[plan].userSeats;
      const repo = repoOnPlan(plan);
      const results = Array.from({ length: limit + 1 }, (_, index) =>
        repo.invitations.create(admin, {
          email: `member${index}@acme-gmbh.de`,
          role: "corporate",
          companyId: "co-acme",
          acceptanceTokenHash: `hash-${plan}-${index}`
        })
      );

      // The seed company already uses one seat for its own user.
      const accepted = results.filter((result) => result.ok).length;
      expect(accepted, plan).toBe(limit - 1);
      expect(results.find((result) => !result.ok), plan).toMatchObject({ reason: "seat_limit_exceeded" });
    }
  });

  it("NGO contact details stay behind a paid plan until a match unlocks them", () => {
    for (const plan of PLAN_TIERS) {
      expect(PLAN_ENTITLEMENTS[plan].ngoContactAccess, plan).toBe(plan !== "registered");
    }
  });
});

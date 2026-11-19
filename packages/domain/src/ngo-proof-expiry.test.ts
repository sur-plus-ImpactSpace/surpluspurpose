import { describe, expect, it } from "vitest";
import {
  deriveProofValidUntil,
  isNgoProofExpiringSoon,
  isNgoVerified,
  ngoRequiresProofExpiry
} from "./model";
import { createInMemoryRepository, createSeedData, type ActorContext } from "./repository";
import { buildOpsRiskQueue } from "./ops-risk-queue";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };

describe("REQ-NGO-06 proof expiry helpers", () => {
  it("requires expiry for notice-based org types only", () => {
    expect(ngoRequiresProofExpiry("verein")).toBe(true);
    expect(ngoRequiresProofExpiry("freier_traeger")).toBe(true);
    expect(ngoRequiresProofExpiry("public_body")).toBe(false);
    expect(ngoRequiresProofExpiry(null)).toBe(false);
  });

  it("derives validity from notice date + assessment period years", () => {
    expect(deriveProofValidUntil("2023-01-15", 5)).toBe("2028-01-15");
    expect(deriveProofValidUntil("2024-02-29", 3)).toBe("2027-03-01");
  });

  it("treats expired proof as not verified for new promises", () => {
    expect(
      isNgoVerified(
        {
          verificationState: "verified",
          orgType: "verein",
          proofValidUntil: "2025-01-01"
        },
        "2026-06-01T00:00:00.000Z"
      )
    ).toBe(false);
    expect(
      isNgoVerified(
        {
          verificationState: "verified",
          orgType: "public_body",
          proofValidUntil: null
        },
        "2026-06-01T00:00:00.000Z"
      )
    ).toBe(true);
  });

  it("flags the 60-day reminder window", () => {
    expect(
      isNgoProofExpiringSoon(
        {
          verificationState: "verified",
          orgType: "verein",
          proofValidUntil: "2026-07-01"
        },
        "2026-05-15T00:00:00.000Z"
      )
    ).toBe(true);
    expect(
      isNgoProofExpiringSoon(
        {
          verificationState: "verified",
          orgType: "verein",
          proofValidUntil: "2028-01-15"
        },
        "2026-05-15T00:00:00.000Z"
      )
    ).toBe(false);
  });
});

describe("REQ-NGO-06 repository jobs", () => {
  it("requires proof validity on approve for notice-based NGOs", () => {
    const repo = createInMemoryRepository();
    expect(repo.ngos.setVerification("ngo-tafel", "approve", admin)).toEqual({
      ok: false,
      reason: "proof_validity_required"
    });
  });

  it("reminds once inside the 60-day window and surfaces in the Ops queue", () => {
    const seed = createSeedData();
    const kleider = seed.ngos.find((ngo) => ngo.id === "ngo-kleiderkammer");
    expect(kleider).toBeTruthy();
    const now = new Date();
    const validUntil = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30))
      .toISOString()
      .slice(0, 10);
    kleider!.proofValidUntil = validUntil;
    kleider!.proofExpiryRemindedAt = null;

    const repo = createInMemoryRepository(seed);
    const warned = repo.ngos.warnExpiringProofs(now.toISOString());
    expect(warned.map((ngo) => ngo.id)).toEqual(["ngo-kleiderkammer"]);
    expect(repo.ngos.warnExpiringProofs(now.toISOString())).toEqual([]);

    const queue = buildOpsRiskQueue({
      proposedActions: [],
      agentRuns: [],
      ngos: repo.ngos.listForAdmin(admin),
      listings: []
    });
    expect(queue.items.some((item) => item.kind === "ngo_proof_expiring")).toBe(true);
  });

  it("suspends verification on expiry and blocks new proposes", () => {
    const repo = createInMemoryRepository();
    const expired = repo.ngos.expireProofs("2028-01-16T00:00:00.000Z");
    expect(expired.map((ngo) => ngo.id)).toEqual(["ngo-kleiderkammer"]);
    const ngo = repo.ngos.listForAdmin(admin).find((item) => item.id === "ngo-kleiderkammer");
    expect(ngo?.verificationState).toBe("verification_pending");

    const propose = repo.matches.propose(admin, {
      listingId: "lst-standing-desks",
      needId: "need-study-desks"
    });
    expect(propose).toEqual({ ok: false, reason: "ngo_not_verified" });
  });

  it("keeps public_body approve without notice fields", () => {
    const seed = createSeedData();
    const tafel = seed.ngos.find((ngo) => ngo.id === "ngo-tafel");
    expect(tafel).toBeTruthy();
    tafel!.orgType = "public_body";
    const repo = createInMemoryRepository(seed);
    const result = repo.ngos.setVerification("ngo-tafel", "approve", admin);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ngo.proofValidUntil).toBeNull();
    }
  });
});

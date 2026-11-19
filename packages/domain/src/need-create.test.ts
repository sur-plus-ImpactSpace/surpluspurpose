import { describe, expect, it } from "vitest";
import { createInMemoryRepository, type ActorContext, type NeedCreateInput } from "./repository";

const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };
const corporate: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };

function input(overrides: Partial<NeedCreateInput> = {}): NeedCreateInput {
  return {
    title: "Warm blankets for winter shelter",
    category: "Textiles, clothing & workwear",
    quantity: 120,
    city: "Munich",
    country: "Germany",
    story: "Fifty people sleep here each winter night and arrive without any bedding at all.",
    targetGroup: "People in emergency winter shelter",
    deliveryAddress: "Shelter intake, Dachauer Str. 90",
    deliveryPreference: "either",
    hasVehicle: false,
    ...overrides
  };
}

describe("repository.needs.create", () => {
  it("creates an open need for the NGO actor's organization", () => {
    const repo = createInMemoryRepository();
    const result = repo.needs.create(ngo, input({ beneficiaries: 80, story: "Cold nights ahead." }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.need).toMatchObject({
      ngoId: "ngo-kleiderkammer",
      title: "Warm blankets for winter shelter",
      state: "open",
      beneficiaries: 80,
      story: "Cold nights ahead."
    });
    expect(repo.needs.listForNgo("ngo-kleiderkammer").some((need) => need.id === result.need.id)).toBe(true);
  });

  it("does not let a corporate actor create needs", () => {
    const repo = createInMemoryRepository();
    expect(repo.needs.create(corporate, input())).toMatchObject({ ok: false, reason: "actor_not_allowed" });
  });

  it("lets an admin create a need for a named NGO only", () => {
    const repo = createInMemoryRepository();
    expect(repo.needs.create(admin, input())).toMatchObject({ ok: false, reason: "ngo_required" });
    expect(repo.needs.create(admin, input({ ngoId: "ngo-unknown" }))).toMatchObject({
      ok: false,
      reason: "ngo_required"
    });

    const result = repo.needs.create(admin, input({ ngoId: "ngo-kleiderkammer" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.need.ngoId).toBe("ngo-kleiderkammer");
  });

  it("validates the payload", () => {
    const repo = createInMemoryRepository();
    expect(repo.needs.create(ngo, input({ title: "  " }))).toMatchObject({ ok: false, reason: "invalid_title" });
    expect(repo.needs.create(ngo, input({ quantity: 0 }))).toMatchObject({ ok: false, reason: "invalid_quantity" });
    expect(repo.needs.create(ngo, input({ city: "" }))).toMatchObject({ ok: false, reason: "invalid_location" });
    expect(repo.needs.create(ngo, input({ beneficiaries: -1 }))).toMatchObject({
      ok: false,
      reason: "invalid_beneficiaries"
    });
    expect(repo.needs.create(ngo, input({ targetGroup: "  " }))).toMatchObject({
      ok: false,
      reason: "invalid_target_group"
    });
    expect(repo.needs.create(ngo, input({ deliveryAddress: "" }))).toMatchObject({
      ok: false,
      reason: "invalid_delivery_address"
    });
    expect(repo.needs.create(ngo, input({ maxQuantityPerMatch: 0 }))).toMatchObject({
      ok: false,
      reason: "invalid_max_quantity_per_match"
    });
  });

  it("stores the full logistics profile (REQ-NGO-05)", () => {
    const repo = createInMemoryRepository();
    const result = repo.needs.create(
      ngo,
      input({
        deliveryPreference: "collect",
        maxQuantityPerMatch: 40,
        targetGroup: "Shelter overnight guests",
        deliveryAddress: "Ramp B, Sendlinger Str. 12",
        hasVehicle: true
      })
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.need).toMatchObject({
      deliveryPreference: "collect",
      maxQuantityPerMatch: 40,
      targetGroup: "Shelter overnight guests",
      deliveryAddress: "Ramp B, Sendlinger Str. 12",
      hasVehicle: true
    });
  });

  it("defaults optional fields and records an audit event", () => {
    const repo = createInMemoryRepository();
    const result = repo.needs.create(ngo, input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Story is no longer among the optional fields — it is what makes a
    // corporate care, so it is required at the API boundary.
    expect(result.need).toMatchObject({
      targetDate: null,
      beneficiaries: 0,
      urgency: "flexible",
      quantityOpen: false
    });
    expect(
      repo
        .auditEvents.list()
        .some((event) => event.action === "need.created" && event.target === result.need.id)
    ).toBe(true);
  });

  it("saves unverified NGO needs as drafts and promotes them on approve", () => {
    const repo = createInMemoryRepository();
    const drafted = repo.needs.create(admin, input({ ngoId: "ngo-tafel", title: "Draft food crates" }));
    expect(drafted).toMatchObject({ ok: true, need: { state: "draft" } });
    if (!drafted.ok) return;
    expect(repo.auditEvents.list().some((event) => event.action === "need.draft_created")).toBe(true);

    expect(
      repo.matches.propose(admin, { listingId: "lst-standing-desks", needId: drafted.need.id })
    ).toMatchObject({ ok: false, reason: "ngo_not_verified" });

    const approved = repo.ngos.setVerification(
      "ngo-tafel",
      { action: "approve", proofNoticeDate: "2024-01-10", proofAssessmentPeriodYears: 5 },
      admin
    );
    expect(approved.ok).toBe(true);
    expect(repo.needs.get(drafted.need.id)?.state).toBe("open");
  });
});

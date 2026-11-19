import { describe, expect, it } from "vitest";
import { createInMemoryRepository, createSeedData, type ActorContext } from "./repository";
import { isOpsAdminRole, isOpsRole, OPS_ROLES } from "./ops-roles";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const editor: ActorContext = { role: "editor", userId: "usr-editor-ops" };

describe("ops roles", () => {
  it("recognises admin and editor as Ops", () => {
    expect(OPS_ROLES).toEqual(["admin", "editor"]);
    expect(isOpsRole("admin")).toBe(true);
    expect(isOpsRole("editor")).toBe(true);
    expect(isOpsRole("corporate")).toBe(false);
    expect(isOpsAdminRole("admin")).toBe(true);
    expect(isOpsAdminRole("editor")).toBe(false);
  });

  it("lets editors verify NGOs but not set company plans", () => {
    const repo = createInMemoryRepository(createSeedData());
    const ngo = repo.ngos.listForAdmin(editor)[0];
    expect(ngo).toBeTruthy();

    const verified = repo.ngos.setVerification(
      ngo!.id,
      { action: "approve", proofNoticeDate: "2024-01-01", proofAssessmentPeriodYears: 5 },
      editor
    );
    expect(verified.ok).toBe(true);

    const plan = repo.companies.setPlan("co-acme", "registered", editor);
    expect(plan).toEqual({ ok: false, reason: "actor_not_allowed" });

    const adminPlan = repo.companies.setPlan("co-acme", "tree", admin);
    expect(adminPlan.ok).toBe(true);
  });

  it("lets editors propose matches", () => {
    const repo = createInMemoryRepository(createSeedData());
    const result = repo.matches.propose(editor, {
      listingId: "lst-standing-desks",
      needId: "need-study-desks"
    });
    expect(result.ok).toBe(true);
  });

  it("seeds an editor preview user", () => {
    const editorUser = createSeedData().users.find((user) => user.id === "usr-editor-ops");
    expect(editorUser?.role).toBe("editor");
  });
});

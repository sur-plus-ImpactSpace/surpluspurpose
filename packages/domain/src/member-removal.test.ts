import { describe, expect, it } from "vitest";
import { parseMemberRemovalCommand } from "./member-removal-api";
import { createInMemoryRepository, createSeedData, type ActorContext } from "./repository";

const acme: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

function withColleague() {
  const data = createSeedData();
  const template = data.users.find((user) => user.id === "usr-corporate-acme");
  if (!template) throw new Error("seed changed");
  data.users.push({ ...template, id: "usr-colleague", email: "colleague@example.com" });
  data.users.push({ ...template, id: "usr-other-company", companyId: "co-hanse", email: "other@example.com" });

  return createInMemoryRepository(data);
}

describe("repository.users.removeFromCompany", () => {
  it("removes a colleague, frees the seat and audits it", () => {
    const repo = withColleague();
    const before = repo.users.list(acme).length;

    expect(repo.users.removeFromCompany(acme, "usr-colleague")).toEqual({ ok: true });
    expect(repo.users.list(acme)).toHaveLength(before - 1);
    expect(repo.auditEvents.list()[0]).toMatchObject({ action: "member.removed", target: "usr-colleague" });
  });

  it("never removes yourself, another company's member or an unknown user", () => {
    const repo = withColleague();

    expect(repo.users.removeFromCompany(acme, "usr-corporate-acme")).toMatchObject({ reason: "cannot_remove_self" });
    expect(repo.users.removeFromCompany(acme, "usr-other-company")).toMatchObject({ reason: "member_not_found" });
    expect(repo.users.removeFromCompany(acme, "usr-nobody")).toMatchObject({ reason: "member_not_found" });
  });

  it("is for company members only", () => {
    const repo = withColleague();

    expect(repo.users.removeFromCompany(ngo, "usr-colleague")).toMatchObject({ reason: "actor_not_allowed" });
    expect(repo.users.removeFromCompany({ role: "admin", userId: "usr-admin-ops" }, "usr-colleague")).toMatchObject({
      reason: "actor_not_allowed"
    });
  });
});

describe("parseMemberRemovalCommand", () => {
  const headers = (key: string | null) => ({ get: (name: string) => (name === "idempotency-key" ? key : null) });

  it("needs a key and a user id", () => {
    expect(parseMemberRemovalCommand(headers(null), "u")).toMatchObject({ status: 428 });
    expect(parseMemberRemovalCommand(headers("k"), " ")).toMatchObject({ reason: "invalid_user_id" });
    expect(parseMemberRemovalCommand(headers("k"), " u1 ")).toEqual({ ok: true, command: { idempotencyKey: "k", userId: "u1" } });
  });
});

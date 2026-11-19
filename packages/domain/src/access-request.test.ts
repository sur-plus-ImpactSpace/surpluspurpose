import { describe, expect, it } from "vitest";
import { createInMemoryRepository, type ActorContext } from "./repository";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const corporate: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

const input = {
  name: "Ada Lovelace",
  organization: "Analytical GmbH",
  role: "corporate" as const,
  email: "ada@analytical.test",
  phone: null,
  message: "Hello"
};

describe("repository.accessRequests", () => {
  it("starts empty and lists a submitted request for Ops", () => {
    const repo = createInMemoryRepository();
    expect(repo.accessRequests.list(admin)).toEqual([]);

    repo.accessRequests.submit(input);

    expect(repo.accessRequests.list(admin)).toMatchObject([{ ...input, status: "new" }]);
  });

  it("shows the list to Ops only", () => {
    const repo = createInMemoryRepository();
    repo.accessRequests.submit(input);

    expect(repo.accessRequests.list(corporate)).toEqual([]);
    expect(repo.accessRequests.list(ngo)).toEqual([]);
  });

  it("keeps one entry per email and refreshes its details", () => {
    const repo = createInMemoryRepository();
    repo.accessRequests.submit(input);
    repo.accessRequests.submit({ ...input, name: "Ada L.", role: "ngo" });

    expect(repo.accessRequests.list(admin)).toMatchObject([{ name: "Ada L.", role: "ngo" }]);
  });

  it("lists the newest request first", () => {
    const repo = createInMemoryRepository();
    repo.accessRequests.submit(input);
    repo.accessRequests.submit({ ...input, email: "bob@other.test", name: "Bob" });

    expect(repo.accessRequests.list(admin).map((request) => request.name)).toEqual(["Bob", "Ada Lovelace"]);
  });
});

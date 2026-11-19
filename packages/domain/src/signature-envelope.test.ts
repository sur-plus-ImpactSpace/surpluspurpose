import { describe, expect, it } from "vitest";
import { parseSignatureEnvelopeCommand } from "./signature-envelope-api";
import { createInMemoryRepository, createSeedData, type ActorContext, type SignatureEnvelopeInput } from "./repository";

const admin: ActorContext = { role: "admin", userId: "usr-admin-ops" };
const acme: ActorContext = { role: "corporate", userId: "usr-corporate-acme", companyId: "co-acme" };
const ngo: ActorContext = { role: "ngo", userId: "usr-ngo-kleiderkammer", ngoId: "ngo-kleiderkammer" };

/** A repository with a completed jackets match, so a certificate exists for co-hanse / the NGO. */
function setup() {
  const repo = createInMemoryRepository(createSeedData());
  repo.matches.transition("mat-jackets", "in_transit", admin);
  repo.matches.transition("mat-jackets", "delivered", admin);
  repo.matches.transition("mat-jackets", "completed", ngo);
  const certificate = repo.documents.list(admin).find((doc) => doc.matchId === "mat-jackets" && doc.kind === "certificate");
  if (!certificate) throw new Error("no certificate");
  const input: SignatureEnvelopeInput = {
    documentId: certificate.id,
    externalId: "sub_1",
    companyName: "Jonas",
    companyEmail: "Jonas@Hanse.test",
    ngoName: "Board",
    ngoEmail: "board@ngo.test"
  };

  return { repo, input, certificate };
}

describe("repository.signatureEnvelopes", () => {
  it("lets Ops record an envelope with both signers", () => {
    const { repo, input } = setup();
    const result = repo.signatureEnvelopes.create(admin, input);

    expect(result).toMatchObject({ ok: true, envelope: { state: "sent", externalId: "sub_1" } });
    if (result.ok) expect(result.envelope.recipients.map((item) => item.partyEmail)).toEqual(["jonas@hanse.test", "board@ngo.test"]);
    expect(repo.auditEvents.list()[0]).toMatchObject({ action: "document.signature_requested" });
  });

  it("is Ops only, certificates only, one live envelope per document", () => {
    const { repo, input } = setup();
    const report = repo.documents.list(admin).find((doc) => doc.matchId === "mat-jackets" && doc.kind === "report");

    expect(repo.signatureEnvelopes.create(acme, input)).toMatchObject({ reason: "actor_not_allowed" });
    expect(repo.signatureEnvelopes.create(admin, { ...input, documentId: report!.id })).toMatchObject({ reason: "not_signable" });
    expect(repo.signatureEnvelopes.create(admin, { ...input, ngoEmail: " " })).toMatchObject({ reason: "invalid_envelope" });
    expect(repo.signatureEnvelopes.create(admin, { ...input, documentId: "nope" })).toMatchObject({ reason: "document_not_found" });
    expect(repo.signatureEnvelopes.create(admin, input).ok).toBe(true);
    expect(repo.signatureEnvelopes.create(admin, { ...input, externalId: "sub_2" })).toMatchObject({ reason: "envelope_exists" });
  });

  it("moves only through DocuSeal events: viewed, signed, completed", () => {
    const { repo, input } = setup();
    repo.signatureEnvelopes.create(admin, input);

    expect(repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "viewed", email: "jonas@hanse.test" })).toBe("sent");
    expect(repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "signed", email: "JONAS@hanse.test" })).toBe("partially_signed");
    expect(repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "signed", email: "board@ngo.test" })).toBe("completed");
    const envelope = repo.signatureEnvelopes.list(admin)[0]!;
    expect(envelope.recipients.every((item) => item.status === "signed" && item.signedAt)).toBe(true);
    expect(repo.auditEvents.list().filter((event) => event.action === "document.signed")).toHaveLength(1);
  });

  it("attaches the signed copy afterwards without a second audit entry, and ignores replays", () => {
    const { repo, input } = setup();
    repo.signatureEnvelopes.create(admin, input);
    repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "completed" });
    repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "completed", signedStoragePath: "sub_1.pdf" });
    repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "declined", email: "board@ngo.test" });

    const envelope = repo.signatureEnvelopes.list(admin)[0]!;
    expect(envelope).toMatchObject({ state: "completed", signedStoragePath: "sub_1.pdf" });
    expect(repo.auditEvents.list().filter((event) => event.action === "document.signed")).toHaveLength(1);
  });

  it("records a decline and lets Ops send again", () => {
    const { repo, input } = setup();
    repo.signatureEnvelopes.create(admin, input);

    expect(repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "declined", email: "board@ngo.test" })).toBe("declined");
    expect(repo.signatureEnvelopes.applyDocusealEvent({ externalId: "sub_1", event: "signed", email: "jonas@hanse.test" })).toBe("declined");
    expect(repo.signatureEnvelopes.create(admin, { ...input, externalId: "sub_2" }).ok).toBe(true);
  });

  it("ignores an unknown submission", () => {
    expect(createInMemoryRepository(createSeedData()).signatureEnvelopes.applyDocusealEvent({ externalId: "nope", event: "completed" })).toBeUndefined();
  });

  it("shows an envelope to the parties of the match and to Ops, not to strangers", () => {
    const { repo, input } = setup();
    repo.signatureEnvelopes.create(admin, input);

    expect(repo.signatureEnvelopes.list(admin)).toHaveLength(1);
    expect(repo.signatureEnvelopes.list(ngo)).toHaveLength(1);
    expect(repo.signatureEnvelopes.list(acme)).toHaveLength(0);
  });
});

describe("parseSignatureEnvelopeCommand", () => {
  const headers = (key: string | null) => ({ get: (name: string) => (name === "idempotency-key" ? key : null) });

  it("needs a key and a document id", () => {
    expect(parseSignatureEnvelopeCommand(headers(null), { documentId: "d" })).toMatchObject({ status: 428 });
    expect(parseSignatureEnvelopeCommand(headers("k"), null)).toMatchObject({ reason: "invalid_payload" });
    expect(parseSignatureEnvelopeCommand(headers("k"), { documentId: " " })).toMatchObject({ reason: "invalid_document_id" });
    expect(parseSignatureEnvelopeCommand(headers("k"), { documentId: " d1 " })).toEqual({ ok: true, command: { idempotencyKey: "k", documentId: "d1" } });
  });
});

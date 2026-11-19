# ADR 0033: Donation CASE model (REQ-CORP-01)

Date: 2026-11-13

## Status

Accepted — Phase 1 M2 (first slice). Confirmation gate landed as ADR 0034
(REQ-CORP-02). Allocation entities (REQ-MATCH-09) follow later.

## Context

Phase 1 needs one donation **case** with many **positions**, not one listing per
SKU. Matching today is listing-centric; a big-bang cutover would break matches,
quota, certificates and Ops propose. The Phase 1 exit flow names seven steps:
contact → inventory → confirm → allocation → handover → paperwork → report.

## Decision

1. Add parallel tables `donation_cases` and `donation_positions`. Listings and
   matches stay the live matching path until a later migration bridges or
   replaces them.
2. A case belongs to one company and stores `step` (1–7), contact, location and
   time window. Named steps (domain constants):
   `contact | inventory | confirm | allocation | handover | paperwork | report`.
3. A position belongs to one case and stores category, model, quantity,
   condition, provenance and a position `state`. Creating a position advances
   the case from step 1 to 2 when still on contact.
4. Writes go through security-definer RPCs (`create_donation_case`,
   `add_donation_position`, `import_donation_positions`) with the same actor /
   verification / audit pattern as `create_listing`. CSV/Excel column mapping
   is parsed in domain; the import RPC inserts the mapped rows.
5. `confirmed_at` on the case is reserved for REQ-CORP-02; allocation RPCs must
   refuse until that gate lands.

## Consequences

- Corporates can build a multi-position donation case in preview and via RPC
  without touching match quota.
- Ops allocation UI remains listing-based until MATCH-09 wires positions.
- Seed includes one sample case with positions so `/cases` is not empty in
  preview.

# ADR 0035: Full needs profile (REQ-NGO-05)

Date: 2026-11-16

## Status

Accepted — Phase 1 M3.

## Context

Ops must allocate without phoning the NGO back. Quantity / any, urgency,
deadline, categories and city/country already exist. Still missing: delivery
preference, max quantity per match, target group, a delivery address that may
differ from the registered NGO address, and whether the NGO has a vehicle.

## Decision

1. Extend `needs` with:
   - `delivery_preference` enum `collect | ship | either` (default `either`)
   - `max_quantity_per_match` nullable positive int (null = no per-match cap)
   - `target_group` text (required on create)
   - `delivery_address` text (street/building; required on create)
   - `has_vehicle` boolean (default false)
2. Existing `city` / `country` on the need remain the delivery locality and may
   already differ from `ngos.address` / NGO registered city.
3. `create_need` accepts the new fields and also persists `urgency` /
   `quantity_open` (previously only defaulted in SQL).
4. `propose_match` (preview + RPC) refuses or caps quantities that exceed
   `max_quantity_per_match` (`quantity_exceeds_max_per_match`).
5. `open_needs_directory` exposes preference, max qty and target group for
   matching browse. Delivery address and vehicle stay off the anonymised row
   (address is contact-adjacent; vehicle is NGO/Ops logistics).

## Consequences

- NGO `/needs` form collects the full profile before post.
- MATCH-10 still owns the eventual per-allocation delivery mode/date; this ADR
  only records the NGO's standing preference on the need.

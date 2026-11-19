/**
 * REQ-OPS-14 — two roles inside Ops.
 *
 * `admin` keeps platform configuration (plans, CO₂ factors, Ops roster).
 * `editor` runs day-to-day Ops work (verify orgs, propose/fail matches, risk queue).
 * Both require AAL2 in Postgres via `current_role_of()` (migration 0059).
 */

export const OPS_ROLES = ["admin", "editor"] as const;
export type OpsRole = (typeof OPS_ROLES)[number];

export function isOpsRole(role: string | null | undefined): role is OpsRole {
  return role === "admin" || role === "editor";
}

export function isOpsAdminRole(role: string | null | undefined): role is "admin" {
  return role === "admin";
}

import type { MatchState, UserRole } from "@surplus/domain";

export type MatchNextAction = {
  nextState: MatchState;
  label: string;
  hint: string;
};

/**
 * Pure: the single next step this actor may take on a match in `state`.
 * Mirrors the domain TRANSITION_RULES so the button only appears when the
 * server would actually allow the move (the server still re-checks).
 *
 * Lives in a server-safe module (no "use client"): server components call it
 * during render; the client component only receives the resulting action.
 */
export function nextMatchActionForRole(state: MatchState, role: UserRole): MatchNextAction | null {
  if (role === "ngo") {
    if (state === "proposed") {
      return { nextState: "ngo_confirmed", label: "Confirm fit", hint: "Confirm this surplus fits your need." };
    }
    if (state === "delivered") {
      return { nextState: "completed", label: "Confirm receipt", hint: "Confirm the goods arrived — this finalizes the impact record." };
    }
  }
  if (role === "corporate") {
    if (state === "ngo_confirmed") {
      return { nextState: "both_confirmed", label: "Confirm match", hint: "Confirm to unlock NGO contact details and start logistics." };
    }
  }
  if (role === "admin" || role === "editor") {
    if (state === "both_confirmed") {
      return { nextState: "in_transit", label: "Mark picked up", hint: "Record that the goods left the company." };
    }
    if (state === "in_transit") {
      return { nextState: "delivered", label: "Mark delivered", hint: "Record delivery to the NGO." };
    }
  }
  return null;
}

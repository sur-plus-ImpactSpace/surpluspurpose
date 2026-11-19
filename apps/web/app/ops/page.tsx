import Home from "../page";

export const dynamic = "force-dynamic";

/**
 * Ops home. `requiredRole: "admin"` on Home means "any Ops role" (admin|editor)
 * after REQ-OPS-14 — editors share this cockpit; plan/roster stay admin-only.
 */
export default function OpsPage() {
  return Home({
    requiredRole: "admin",
    searchParams: Promise.resolve({
      role: "admin"
    })
  });
}

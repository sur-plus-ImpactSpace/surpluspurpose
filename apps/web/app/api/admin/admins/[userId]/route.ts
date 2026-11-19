import { NextRequest } from "next/server";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

/**
 * Super admin only: take admin access away. The admin profile is deleted, so the
 * account can still sign in but no longer reaches the admin console. The super
 * admin and the caller themselves cannot be removed. Audited.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const superAdmin = process.env.SURPLUS_SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (!url || !anonKey || !serviceKey || !superAdmin) return routeJson({ error: "admin_invites_not_configured" }, 503);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return routeJson({ error: "auth_required" }, 401);

  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization }, cache: "no-store" });
  if (!who.ok) return routeJson({ error: "auth_required" }, 401);
  const caller = (await who.json().catch(() => null)) as { email?: string; id?: string } | null;
  if (!caller?.id || caller.email?.toLowerCase() !== superAdmin) return routeJson({ error: "super_admin_only" }, 403);

  const limited = await enforceRouteRateLimit({ actorId: caller.id, endpointId: "admin.remove", policy: "strict" });
  if (limited) return limited;

  const { userId } = await params;
  if (userId === caller.id) return routeJson({ error: "cannot_remove_self" }, 422);

  const service = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const found = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=email,role`, { headers: service, cache: "no-store" });
  const [target] = found.ok ? ((await found.json().catch(() => [])) as Array<{ email: string; role: string }>) : [];
  if (!target || target.role !== "admin") return routeJson({ error: "not_found" }, 404);
  if (target.email.toLowerCase() === superAdmin) return routeJson({ error: "cannot_remove_super_admin" }, 422);

  const removed = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&role=eq.admin`, {
    method: "DELETE",
    headers: service,
    cache: "no-store"
  });
  if (!removed.ok) return routeJson({ error: "persistence_unavailable" }, 502);

  await fetch(`${url}/rest/v1/audit_events`, {
    method: "POST",
    headers: service,
    body: JSON.stringify({ actor: caller.id, action: "admin.remove", target: userId, visibility: "admin_only" }),
    cache: "no-store"
  }).catch(() => undefined);

  return routeJson({ ok: true }, 200);
}

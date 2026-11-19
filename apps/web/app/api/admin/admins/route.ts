import { NextRequest } from "next/server";
import { adminHostFromEnv } from "../../../lib/admin-host";
import { deliverAdminInviteEmail } from "../../_lib/invitation-email";
import { enforceRouteRateLimit } from "../../_lib/rate-limit";
import { routeJson } from "../../_lib/route-workspace";

export const dynamic = "force-dynamic";

/**
 * Super admin only: invite another admin. The account is created by the server
 * (service role) and the set-password link is e-mailed through Resend; there is no
 * public way to become an admin. The super admin is the account whose e-mail is
 * SURPLUS_SUPERADMIN_EMAIL (seeded with `pnpm seed:superadmin`).
 */
export async function POST(request: NextRequest) {
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

  const limited = await enforceRouteRateLimit({ actorId: caller.id, endpointId: "admin.invite", policy: "strict" });
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { email?: unknown; fullName?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() || null : null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return routeJson({ error: "invalid_email" }, 422);

  const service = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const adminHost = adminHostFromEnv();
  const origin = adminHost ? `https://${adminHost}` : request.nextUrl.origin;

  // New address: creates the (unconfirmed) account and returns the one-time link to set a password.
  // Address that already has an account: a recovery link does the same job without creating anything.
  let link: { action_link?: string; id?: string } | null = null;
  for (const type of ["invite", "recovery"] as const) {
    const generated = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: service,
      body: JSON.stringify({ type, email, redirect_to: `${origin}/ops/set-password` }),
      cache: "no-store"
    });
    const body = (await generated.json().catch(() => null)) as { action_link?: string; id?: string } | null;
    if (generated.ok && body?.action_link && body.id) {
      link = body;
      break;
    }
  }
  if (!link?.action_link || !link.id) return routeJson({ error: "invite_failed" }, 502);

  const profile = await fetch(`${url}/rest/v1/users?on_conflict=id`, {
    method: "POST",
    headers: { ...service, prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: link.id, email, full_name: fullName, role: "admin", company_id: null, ngo_id: null }),
    cache: "no-store"
  });
  if (!profile.ok) return routeJson({ error: "profile_failed" }, 502);

  await fetch(`${url}/rest/v1/audit_events`, {
    method: "POST",
    headers: service,
    body: JSON.stringify({ actor: caller.id, action: "admin.invite", target: link.id, visibility: "admin_only" }),
    cache: "no-store"
  }).catch(() => undefined);

  const delivery = await deliverAdminInviteEmail(email, link.action_link);

  return routeJson({ ok: true, delivery: delivery.status }, 201);
}

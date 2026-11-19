import { NextRequest } from "next/server";
import { deliverAccessInviteEmail } from "../../../_lib/invitation-email";
import { enforceRouteRateLimit } from "../../../_lib/rate-limit";
import { routeJson } from "../../../_lib/route-workspace";

export const dynamic = "force-dynamic";

/**
 * Ops answers a lead from the public "Request access" form. `invite` e-mails the
 * lead a link to create their account and marks the request invited; `decline`
 * only marks it declined. The status is written server-side (service role) after
 * the caller is confirmed as an admin, and every change is audited.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)?.replace(/\/+$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return routeJson({ error: "persistence_unavailable" }, 503);

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return routeJson({ error: "auth_required" }, 401);

  const who = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, authorization }, cache: "no-store" });
  if (!who.ok) return routeJson({ error: "auth_required" }, 401);
  const caller = (await who.json().catch(() => null)) as { id?: string } | null;
  if (!caller?.id) return routeJson({ error: "auth_required" }, 401);

  const service = { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" };
  const profile = await fetch(`${url}/rest/v1/users?id=eq.${encodeURIComponent(caller.id)}&select=role`, {
    headers: service,
    cache: "no-store"
  });
  const [row] = profile.ok ? ((await profile.json().catch(() => [])) as Array<{ role?: string }>) : [];
  if (row?.role !== "admin") return routeJson({ error: "admin_only" }, 403);

  const limited = await enforceRouteRateLimit({ actorId: caller.id, endpointId: "admin.access_request", policy: "strict" });
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
  if (body?.action !== "invite" && body?.action !== "decline") return routeJson({ error: "invalid_action" }, 422);

  const { requestId } = await params;
  const found = await fetch(
    `${url}/rest/v1/access_requests?id=eq.${encodeURIComponent(requestId)}&select=id,name,email`,
    { headers: service, cache: "no-store" }
  );
  const [lead] = found.ok ? ((await found.json().catch(() => [])) as Array<{ id: string; name: string; email: string }>) : [];
  if (!lead) return routeJson({ error: "not_found" }, 404);

  if (body.action === "invite") {
    // The lead signs up on the public host, never on the admin host.
    const publicUrl = process.env.SURPLUS_PUBLIC_URL?.trim().replace(/\/+$/, "");
    if (!publicUrl) return routeJson({ error: "public_url_not_configured" }, 503);

    const delivery = await deliverAccessInviteEmail(lead.email, lead.name, `${publicUrl}/login`);
    if (delivery.status !== "sent") return routeJson({ error: "email_not_sent" }, 502);
  }

  const status = body.action === "invite" ? "invited" : "declined";
  const updated = await fetch(`${url}/rest/v1/access_requests?id=eq.${encodeURIComponent(lead.id)}`, {
    method: "PATCH",
    headers: service,
    body: JSON.stringify({ status, handled_at: new Date().toISOString() }),
    cache: "no-store"
  });
  if (!updated.ok) return routeJson({ error: "persistence_unavailable" }, 502);

  await fetch(`${url}/rest/v1/audit_events`, {
    method: "POST",
    headers: service,
    body: JSON.stringify({ actor: caller.id, action: `access_request.${body.action}`, target: lead.id, visibility: "admin_only" }),
    cache: "no-store"
  }).catch(() => undefined);

  return routeJson({ ok: true, status }, 200);
}

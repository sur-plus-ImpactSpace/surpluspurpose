"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBrowserSupabaseClient } from "../../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";

const ERRORS: Record<string, string> = {
  email_not_sent: "The email could not be sent, so nothing was marked.",
  public_url_not_configured: "The public sign-up address is not set up yet.",
  admin_only: "Only admins can do this."
};

/** Invite (e-mails the lead a sign-up link) or decline a request, then refresh the list. */
export function AccessRequestActions({
  config,
  requestId,
  status
}: {
  config: SupabaseBrowserConfig;
  requestId: string;
  status: "new" | "invited" | "declined";
}) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(config), [config]);
  const [pending, setPending] = useState<"invite" | "decline" | null>(null);

  async function act(action: "invite" | "decline") {
    setPending(action);
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/access-requests/${encodeURIComponent(requestId)}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ action })
    }).catch(() => null);
    setPending(null);
    if (!response?.ok) {
      const result = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      toast.error(ERRORS[result?.error ?? ""] ?? "Could not save. Try again.");
      return;
    }
    toast.success(action === "invite" ? "Invitation sent." : "Request declined.");
    router.refresh();
  }

  return (
    <div className="flex w-full gap-3">
      <Button className="h-12 min-w-36 flex-1 px-8 text-base font-semibold" size="lg" disabled={pending !== null} onClick={() => void act("decline")} variant="outline">
        {pending === "decline" ? "Saving…" : "Decline"}
      </Button>
      <Button className="h-12 min-w-36 flex-1 px-8 text-base font-semibold" size="lg" disabled={pending !== null} onClick={() => void act("invite")} >
        {pending === "invite" ? "Sending…" : status === "invited" ? "Send again" : "Invite"}
      </Button>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getBrowserSupabaseClient } from "../../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../../lib/service-chat-realtime";

/** Remove admin access (super admin only). Asks once before it acts. */
export function RemoveAdminButton({ config, email, userId }: { config: SupabaseBrowserConfig; email: string; userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => getBrowserSupabaseClient(config), [config]);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`/api/admin/admins/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${data.session?.access_token ?? ""}` }
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      toast.error("Could not remove this admin.");
      return;
    }
    toast.success(`${email} is no longer an admin.`);
    router.refresh();
  }

  if (!confirming) {
    return (
      <Button className="h-12 w-full text-base text-destructive" onClick={() => setConfirming(true)} type="button" variant="outline">
        Remove admin access
      </Button>
    );
  }

  return (
    <div className="flex w-full gap-3">
      <Button className="h-12 flex-1 text-base" disabled={pending} onClick={() => setConfirming(false)} type="button" variant="outline">
        Cancel
      </Button>
      <Button className="h-12 flex-1 text-base" disabled={pending} onClick={() => void remove()} type="button" variant="destructive">
        {pending ? "Removing…" : "Yes, remove"}
      </Button>
    </div>
  );
}

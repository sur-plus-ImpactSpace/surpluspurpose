"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField } from "./FormField";
import { useMemo, useState, type FormEvent } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";
import { passwordMeetsPolicy } from "./SmartLoginPanel";

const POLICY_HINT = "Use at least 8 characters with upper and lower case, a number and a symbol.";

/**
 * The admin's own account: change password. (Inviting admins lives on the Admins tab.)
 */
export function AdminAccountPanel({ config }: { config: SupabaseBrowserConfig }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <ChangePasswordCard config={config} />
    </section>
  );
}

function ChangePasswordCard({ config }: { config: SupabaseBrowserConfig }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(config), [config]);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const password = String(new FormData(formElement).get("password") ?? "");
    if (!passwordMeetsPolicy(password)) {
      setError(POLICY_HINT);
      return;
    }
    setError(undefined);
    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) {
      toast.error(updateError.message.toLowerCase().includes("different") ? "Choose a password you have not used." : "Could not change the password.");
      return;
    }
    formElement.reset();
    toast.success("Password changed.");
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <h2 className="text-lg font-semibold">Change password</h2>
      <form className="mt-4 grid gap-4" noValidate onSubmit={(event) => void submit(event)}>
        <FormField label="New password" error={error} autoComplete="new-password" name="password" onChange={() => setError(undefined)} type="password" />
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Change password"}
        </Button>
      </form>
    </div>
  );
}

/** "Invite admin" button with its form in a dialog (super admin only). */
export function InviteAdminDialog({ config }: { config: SupabaseBrowserConfig }) {
  const supabase = useMemo(() => getBrowserSupabaseClient(config), [config]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(undefined);
    setPending(true);
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ email, fullName: String(form.get("fullName") ?? "") })
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      toast.error(response?.status === 403 ? "Only the super admin can invite admins." : response?.status === 429 ? "Too many tries. Wait a minute." : "Could not create the invitation. Check the email address.");
      return;
    }
    const result = (await response.json().catch(() => ({}))) as { delivery?: string };
    formElement.reset();
    setOpen(false);
    router.refresh();
    if (result.delivery === "sent") toast.success(`Invitation sent to ${email}.`);
    else toast.warning(`Admin created for ${email}, but the email was not sent (email delivery is not configured).`);
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="lg">
          <UserPlus aria-hidden="true" /> Invite admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite an admin</DialogTitle>
          <DialogDescription>They get an email to choose a password. Only you can do this.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" noValidate onSubmit={(event) => void submit(event)}>
          <FormField label="Name (optional)" name="fullName" />
          <FormField autoComplete="off" error={error} label="Email" name="email" onChange={() => setError(undefined)} type="email" />
          <Button className="h-12 text-base" disabled={pending} type="submit">
            {pending ? "Sending…" : "Send invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { browserRouteHeaders } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type InviteRole = "corporate" | "ngo";
type InvitationMode = "admin" | "corporate" | "ngo";
type DeliveryStatus = "sent" | "skipped" | "failed";

export type InvitationOrgOption = {
  id: string;
  label: string;
  role: InviteRole;
};

type InvitationCreatePanelProps = {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  defaultOrgId: string;
  defaultRole: InviteRole;
  mode: InvitationMode;
  orgOptions: InvitationOrgOption[];
};

type InvitationCreateResponse =
  | {
      acceptanceUrl: string | null;
      delivery: {
        provider: string;
        reason?: string;
        status: DeliveryStatus;
      };
      invitation: {
        email: string;
        role: InviteRole;
        status: string;
      };
      runtime: "preview-route-handler" | "supabase-rpc";
    }
  | {
      error: string;
    };

export function InvitationCreatePanel({
  actorUserId,
  authConfig,
  defaultOrgId,
  defaultRole,
  mode,
  orgOptions
}: InvitationCreatePanelProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [role, setRole] = useState<InviteRole>(defaultRole);
  const [orgId, setOrgId] = useState(defaultOrgId);
  const [message, setMessage] = useState<string | null>(null);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const idempotencyPrefix = useMemo(() => stableId(), []);
  const editableScope = mode === "admin";
  const availableRoles = useMemo(
    () => Array.from(new Set(orgOptions.map((option) => option.role))),
    [orgOptions]
  );
  const availableOrgs = useMemo(
    () => orgOptions.filter((option) => option.role === role),
    [orgOptions, role]
  );
  const selectedOrg = availableOrgs.find((option) => option.id === orgId) ?? availableOrgs[0];
  const disabled = isSubmitting || isRefreshing || !selectedOrg || !email.trim();

  function selectRole(nextRole: InviteRole) {
    setRole(nextRole);
    setOrgId(orgOptions.find((option) => option.role === nextRole)?.id ?? "");
    setFallbackLink(null);
    setMessage(null);
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      setMessage("Enter a valid email address.");
      return;
    }
    if (!selectedOrg) {
      setMessage("Select a workspace first.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setFallbackLink(null);

    try {
      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setMessage("Sign in before sending workspace invitations.");
        return;
      }

      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          ...headers,
          "idempotency-key": `${idempotencyPrefix}-invite-${Date.now()}`
        },
        body: JSON.stringify({
          email: normalizedEmail,
          role,
          companyId: role === "corporate" ? selectedOrg.id : undefined,
          ngoId: role === "ngo" ? selectedOrg.id : undefined,
          orgName: selectedOrg.label,
          expiresAt: expiresAt || undefined
        })
      });
      const body = (await response.json().catch(() => ({ error: "invalid_response" }))) as InvitationCreateResponse;

      if (!response.ok || "error" in body) {
        setMessage(`Invitation failed: ${"error" in body ? body.error : response.status}`);
        return;
      }

      setEmail("");
      setFallbackLink(body.acceptanceUrl);
      setMessage(invitationMessage(body.delivery.status, body.delivery.provider, body.delivery.reason));
      if (body.runtime === "supabase-rpc") {
        startRefresh(() => router.refresh());
      }
    } catch {
      setMessage("Invitation failed: network_error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card shadow-xs p-5">
      <p className="text-xs font-medium text-primary">
        Workspace access
      </p>
      <h2 className="mt-2 text-xl font-semibold">Invite workspace user</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{introText(mode)}</p>

      <form className="mt-5 grid gap-4" onSubmit={(event) => void submitInvite(event)}>
        <label className="grid gap-2 text-sm font-semibold text-muted-foreground">
          Email
          <Input
            autoComplete="email"
            
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.org"
            type="email"
            value={email}
          />
        </label>

        {editableScope ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-muted-foreground">
              Role
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm min-h-12"
                onChange={(event) => selectRole(event.target.value as InviteRole)}
                value={role}
              >
                {availableRoles.includes("corporate") ? <option value="corporate">Corporate</option> : null}
                {availableRoles.includes("ngo") ? <option value="ngo">NGO</option> : null}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-muted-foreground">
              Workspace
              <select
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 md:text-sm min-h-12"
                onChange={(event) => setOrgId(event.target.value)}
                value={selectedOrg?.id ?? ""}
              >
                {availableOrgs.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted p-3 text-sm">
            <p className="font-semibold text-black">{selectedOrg?.label ?? "Workspace unavailable"}</p>
            <p className="mt-1 text-muted-foreground">{role === "corporate" ? "Corporate" : "NGO"} access only</p>
          </div>
        )}

        <label className="grid gap-2 text-sm font-semibold text-muted-foreground">
          Expiry
          <Input
            
            onChange={(event) => setExpiresAt(event.target.value)}
            type="date"
            value={expiresAt}
          />
        </label>

        <Button size="lg" disabled={disabled} type="submit">
          {isSubmitting ? "Sending..." : "Send invite"}
        </Button>
      </form>

      {message ? (
        <p className="mt-4 rounded-lg border border-border bg-muted p-3 text-sm leading-5 text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {fallbackLink ? (
        <a
          className="mt-3 block break-all rounded-lg border border-border bg-muted p-3 text-xs font-semibold text-muted-foreground"
          href={fallbackLink}
        >
          Fallback invite link: {fallbackLink}
        </a>
      ) : null}
    </section>
  );
}

function introText(mode: InvitationMode): string {
  if (mode === "admin") return "Create Corporate or NGO access from sur.plus Ops after the workspace is ready.";
  if (mode === "ngo") return "Add trusted NGO colleagues after verification so receipts and logistics stay accountable.";

  return "Add Corporate colleagues to handle listings, matches and evidence in the same workspace.";
}

function invitationMessage(status: DeliveryStatus, provider: string, reason?: string): string {
  if (status === "sent") return `Invitation sent via ${provider}.`;
  if (status === "skipped") return `Invitation created. Email delivery is not configured${reason ? `: ${reason}` : "."}`;

  return `Invitation created, but delivery failed via ${provider}. Use the fallback link or resend from Ops.`;
}

function stableId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { Dictionary } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type ClaimStrings = Dictionary["auth"]["claim"];

const PROOF_BUCKET = "ngo-verification";
const PROOF_MAX_BYTES = 15 * 1024 * 1024;
const PROOF_ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * The self-service end of the funnel. This replaces the dead end where a
 * confirmed signup sat on "Workspace access pending" until Flo ran SQL by
 * hand: it reads the role chosen at registration from the session metadata,
 * prefills the organisation name captured there, and calls claim_workspace()
 * (0019). Safe because a claimed corporate lands on the browse-only
 * `registered` plan and a claimed NGO starts unverified in the Ops queue —
 * the RPC grants presence, never entitlements.
 *
 * Invited users never see this: an invitation provisions on acceptance, and
 * a provisioned account no longer reaches the pending screen at all.
 */
export function ClaimWorkspacePanel({
  config,
  t
}: {
  config: SupabaseBrowserConfig | null;
  t: ClaimStrings;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [requestedRole, setRequestedRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    const client = getBrowserSupabaseClient(config);
    void client.auth.getUser().then(({ data }) => {
      if (data.user?.id) setUserId(data.user.id);
      const meta = data.user?.user_metadata as Record<string, unknown> | undefined;
      if (typeof meta?.requested_role === "string") setRequestedRole(meta.requested_role);
      if (typeof meta?.org_name === "string" && meta.org_name.trim()) {
        setOrgName((current) => current || (meta.org_name as string));
      }
    });
  }, [config]);

  // Without auth config there is no RPC to call; without a chosen role the
  // account came from before the register flow existed (or via an invite that
  // is being accepted in the panel below) — the manual path still applies.
  if (!config || (requestedRole !== "corporate" && requestedRole !== "ngo")) return null;

  const isNgo = requestedRole === "ngo";

  async function claim() {
    if (!config) return;
    // NGOs submit their eligibility proof as the final registration step.
    if (isNgo) {
      if (!proofFile) {
        setError(t.proofRequired);
        return;
      }
      if (!PROOF_ALLOWED.includes(proofFile.type)) {
        setError(t.proofHint);
        return;
      }
      if (proofFile.size > PROOF_MAX_BYTES) {
        setError(t.proofUploadFailed);
        return;
      }
    }
    setPending(true);
    setError(null);
    try {
      const client = getBrowserSupabaseClient(config);
      const { error: rpcError } = await client.rpc("claim_workspace", {
        p_org_name: orgName.trim()
      });
      if (rpcError) {
        // user_already_provisioned means a refresh will land in the workspace.
        if (rpcError.message.includes("user_already_provisioned")) {
          router.refresh();
          return;
        }
        setError(claimErrorText(t, rpcError.message));
        return;
      }

      // The NGO now exists, so its proof can be filed. Best-effort: if the
      // upload fails the workspace still opened and the proof can be uploaded
      // from the dashboard, so we surface a note but still proceed.
      if (isNgo && proofFile && userId) {
        const ext = proofFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
        const path = `${userId}/${Date.now()}.${ext}`;
        const upload = await client.storage.from(PROOF_BUCKET).upload(path, proofFile, {
          cacheControl: "3600",
          contentType: proofFile.type,
          upsert: false
        });
        if (!upload.error) {
          await client.rpc("add_ngo_verification_document", {
            p_path: path,
            p_mime: proofFile.type,
            p_size: proofFile.size,
            p_title: proofFile.name
          });
        } else {
          setError(t.proofUploadFailed);
        }
      }

      router.refresh();
    } catch {
      setError(t.errorNetwork);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground">
        {requestedRole === "ngo" ? t.ngoEyebrow : t.corporateEyebrow}
      </h2>
      <Input
        aria-label={t.orgNameAria}
        autoComplete="organization"
        
        disabled={pending}
        maxLength={160}
        onChange={(event) => setOrgName(event.target.value)}
        placeholder={requestedRole === "ngo" ? t.ngoPlaceholder : t.corporatePlaceholder}
        value={orgName}
      />
      {isNgo ? (
        <label className="grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">
            {t.proofLabel}
          </span>
          <input
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-foreground"
            disabled={pending}
            onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
      ) : null}
      <Button disabled={pending || orgName.trim().length < 2 || (isNgo && !proofFile)} onClick={() => void claim()} type="button">
        {pending ? t.settingUp : t.openWorkspace}
      </Button>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
    </div>
  );
}

function claimErrorText(t: ClaimStrings, message: string): string {
  if (message.includes("invalid_org_name")) return t.errorInvalidName;
  if (message.includes("no_requested_role")) return t.errorNoRole;
  if (message.includes("freemail_not_allowed")) return t.errorFreemail;
  if (message.includes("not_authenticated")) return t.errorNotAuthenticated;
  return t.errorGeneric;
}

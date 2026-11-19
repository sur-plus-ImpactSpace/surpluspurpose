"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

const BUCKET = "company-verification";
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * ADR 0027 C1: a corporate submits a business proof (e.g. a commercial-register
 * extract / Handelsregisterauszug) before Ops can verify it. The file goes to
 * the PRIVATE `company-verification` bucket under the caller's own uid folder
 * (RLS-enforced); add_company_verification_document files the row. Ops cannot
 * approve until at least one document exists. No public URL — Ops downloads use
 * server-side signed URLs. Needs a real Supabase session; preview renders a hint.
 */
export function CompanyVerificationUpload({
  actorUserId,
  config
}: {
  actorUserId: string;
  config: SupabaseBrowserConfig | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!config) {
    return (
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Uploading your business proof is available once you sign in to your workspace.
      </p>
    );
  }
  const activeConfig = config;

  async function onFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      setStatus("Use a PDF, JPG, PNG or WebP file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("File is larger than 15 MB.");
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const supabase = getBrowserSupabaseClient(activeConfig);
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${actorUserId}/${Date.now()}.${ext}`;

      const upload = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });
      if (upload.error) {
        setStatus(`Upload failed: ${upload.error.message}`);
        return;
      }

      const { error } = await supabase.rpc("add_company_verification_document", {
        p_path: path,
        p_mime: file.type,
        p_size: file.size,
        p_title: file.name
      });
      if (error) {
        setStatus(`Could not file the document: ${error.message}`);
        return;
      }

      setStatus("Proof submitted. Ops will review it before verifying you.");
      router.refresh();
    } catch {
      setStatus("Upload failed: network_error");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-xs font-medium text-muted-foreground">
        Business proof
      </p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Upload a commercial-register extract (Handelsregisterauszug) or comparable proof that your
        company is real. Ops reviews it before verifying you.
      </p>
      <input
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
        ref={inputRef}
        type="file"
      />
      <Button variant="outline" size="sm"
 className="mt-2"
 disabled={pending}
 onClick={() => inputRef.current?.click()}
 type="button">
        {pending ? "Uploading…" : "Upload proof"}
      </Button>
      {status ? (
        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

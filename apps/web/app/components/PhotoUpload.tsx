"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getBrowserSupabaseClient } from "../lib/browser-supabase";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

const BUCKET = "listing-photos";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * D1: upload a photo of the surplus for a listing. Uploads to the public
 * `listing-photos` Storage bucket under the caller's own uid folder (RLS), then
 * records the public URL on the listing via the ownership-checked
 * add_listing_photo RPC. Needs a real Supabase session — in the preview/demo
 * (no auth backend) it renders a disabled hint instead.
 */
export function PhotoUpload({
  actorUserId,
  config,
  listingId
}: {
  actorUserId: string;
  config: SupabaseBrowserConfig | null;
  listingId: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!config) {
    return (
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Photo upload is available once you sign in to your workspace.
      </p>
    );
  }
  const activeConfig = config;

  async function onFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      setStatus("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setStatus("Image is larger than 8 MB.");
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const supabase = getBrowserSupabaseClient(activeConfig);
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${actorUserId}/${listingId}/${Date.now()}.${ext}`;

      const upload = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });
      if (upload.error) {
        setStatus(`Upload failed: ${upload.error.message}`);
        return;
      }

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const { error } = await supabase.rpc("add_listing_photo", {
        p_listing_id: listingId,
        p_url: publicUrl
      });
      if (error) {
        setStatus(`Could not attach photo: ${error.message}`);
        return;
      }

      setStatus("Photo added.");
      router.refresh();
    } catch {
      setStatus("Upload failed: network_error");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="mt-3">
      <input
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={pending}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
        ref={inputRef}
        type="file"
      />
      <Button variant="outline" size="sm" disabled={pending} onClick={() => inputRef.current?.click()} type="button">
        {pending ? "Uploading…" : "Add photo"}
      </Button>
      {status ? (
        <p className="mt-1.5 text-xs text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

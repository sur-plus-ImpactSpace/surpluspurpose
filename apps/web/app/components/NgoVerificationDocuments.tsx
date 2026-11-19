"use client";

import { useEffect, useState } from "react";

type VerificationDocument = {
  id: string;
  proofKind: string;
  title: string | null;
  mime: string | null;
  createdAt: string;
  url: string | null;
};

const PROOF_LABEL: Record<string, string> = {
  freistellungsbescheid: "Freistellungsbescheid",
  public_law_proof: "Public-law proof",
  traeger_proof: "Sponsor proof"
};

/**
 * Ops-only list of an NGO's verification proof documents (REQ-NGO-02). Fetches
 * the admin-guarded route on mount and offers a short-lived signed download per
 * file, so Ops can review the proof before approving. The approval control
 * refuses to verify an NGO until at least one document exists.
 */
export function NgoVerificationDocuments({ ngoId }: { ngoId: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/ngos/${encodeURIComponent(ngoId)}/verification-documents`, {
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as {
          documents?: VerificationDocument[];
        };
        if (!active) return;
        if (!response.ok || !payload.documents) {
          setState("error");
          return;
        }
        setDocuments(payload.documents);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [ngoId]);

  if (state === "loading") {
    return <p className="text-sm text-muted-foreground">Loading proof documents…</p>;
  }
  if (state === "error") {
    return <p className="text-sm text-muted-foreground">Could not load proof documents.</p>;
  }
  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No proof submitted yet — approval stays blocked until this NGO uploads its eligibility proof.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        Proof documents ({documents.length})
      </p>
      <ul className="mt-3 grid gap-3">
        {documents.map((document) => (
          <li className="grid gap-3 rounded-xl border border-border bg-muted p-4" key={document.id}>
            {document.url && document.mime?.startsWith("image/") ? (
              <a href={document.url} rel="noreferrer" target="_blank" title="Open the full image">
                <img
                  alt={document.title ?? "Proof document"}
                  className="max-h-80 w-full rounded-lg border border-border bg-card object-contain"
                  src={document.url}
                />
              </a>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {document.title ?? "Proof document"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {PROOF_LABEL[document.proofKind] ?? document.proofKind} ·{" "}
                {new Date(document.createdAt).toLocaleDateString()}
                </span>
              </span>
              {document.url ? (
                <a
                  className="inline-flex h-8 shrink-0 items-center rounded-md border bg-background px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
                  href={document.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open
                </a>
              ) : (
                <span className="shrink-0 text-sm text-muted-foreground">unavailable</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

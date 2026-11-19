"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";

type Doc = { id: string; mime: string | null; title: string | null; url: string | null };

/** The table's "Proof" cell: a small preview of the first uploaded document (or a file icon), and how many there are. */
export function ProofThumb({ kind, id }: { id: string; kind: "companies" | "ngos" }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/${kind}/${encodeURIComponent(id)}/verification-documents`, { cache: "no-store" })
      .then((response) => response.json().catch(() => ({})))
      .then((payload: { documents?: Doc[] }) => {
        if (active) setDocs(payload.documents ?? []);
      })
      .catch(() => {
        if (active) setDocs([]);
      });

    return () => {
      active = false;
    };
  }, [id, kind]);

  if (docs === null) return <span className="inline-block h-10 w-10 animate-pulse rounded-lg bg-foreground/10" />;
  if (docs.length === 0) return <span className="text-sm text-muted-foreground">None</span>;

  const first = docs[0];
  const isImage = Boolean(first?.mime?.startsWith("image/") && first.url);

  return (
    <div className="flex items-center gap-3">
      {isImage ? (
        <img alt={first?.title ?? "Proof document"} className="h-10 w-10 rounded-lg border border-border object-cover" src={first?.url ?? ""} />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
          <FileText aria-hidden="true" size={18} />
        </span>
      )}
      <span className="text-sm text-muted-foreground">{docs.length === 1 ? "1 file" : `${docs.length} files`}</span>
    </div>
  );
}

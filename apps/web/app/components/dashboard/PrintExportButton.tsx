"use client";

import { Button } from "@/components/ui/button";
/**
 * Minimal export: the Impact Dashboard IS the report, so "export" opens the
 * browser print dialog (save-as-PDF) — the same pattern as the generated
 * certificate pages. A dedicated standalone/public report page is a later
 * iteration; this keeps the aggregate report shareable today.
 */
export function PrintExportButton({ label }: { label: string }) {
  return (
    <Button
      
      onClick={() => window.print()}
      type="button"
    >
      {label}
    </Button>
  );
}

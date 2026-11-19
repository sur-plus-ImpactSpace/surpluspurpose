"use client";

import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";

/**
 * The eye icon at the end of an admin row. It opens a dialog with the full detail
 * (and, where it applies, the actions). The content only mounts when opened, so
 * documents are fetched on demand rather than for every row.
 */
export function DetailDialog({
  children,
  footer,
  subtitle,
  title
}: {
  children: ReactNode;
  footer?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button aria-label={`Review ${title}`} data-row-open size="sm" variant="outline">
          <Eye aria-hidden="true" /> Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Label / value pairs inside a dialog. */
export function DetailGrid({ items }: { items: Array<{ label: string; value?: string | null }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 break-words text-sm text-foreground">{item.value?.trim() ? item.value : "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

"use client";

import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * A checkbox with its text beside it. Links inside the label stay clickable
 * without toggling the box.
 */
export function CheckField({
  checked,
  children,
  onChange
}: {
  checked: boolean;
  children: ReactNode;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox checked={checked} className="mt-1" onCheckedChange={(value) => onChange(value === true)} />
      <span className="min-w-0 text-sm leading-6 text-muted-foreground">{children}</span>
    </div>
  );
}

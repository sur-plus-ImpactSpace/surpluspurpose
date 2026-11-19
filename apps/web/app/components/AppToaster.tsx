"use client";

import { Toaster } from "@/components/ui/sonner";

/** Mounted once in the root layout; every `toast.success(...)` / `toast.error(...)` lands here. */
export function AppToaster({ theme }: { theme: "light" | "dark" }) {
  return <Toaster position="top-right" richColors theme={theme} />;
}

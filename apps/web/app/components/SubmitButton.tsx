import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Full-width primary submit button for server-rendered forms. */
export function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <Button className="w-full" size="lg" type="submit">
      {children}
    </Button>
  );
}

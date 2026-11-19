"use client";

import { useState } from "react";
import { SmartLoginPanel } from "./SmartLoginPanel";

type PanelProps = Parameters<typeof SmartLoginPanel>[0];

/**
 * The sign-in column's heading and form together, so the heading can follow the
 * form's mode: "Sign in" while signing in, "Create account" while registering.
 */
export function LoginContent({
  eyebrow,
  subtitle,
  title,
  ...panelProps
}: PanelProps & { eyebrow: string; subtitle: string; title: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const signingUp = mode === "signup";

  return (
    <>
      <p className="text-[11px] font-medium text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{signingUp ? panelProps.panel.createAccount : title}</h1>
      {signingUp ? null : <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{subtitle}</p>}
      <div className={signingUp ? "mt-5" : "mt-6"}>
        <SmartLoginPanel {...panelProps} onModeChange={setMode} />
      </div>
    </>
  );
}

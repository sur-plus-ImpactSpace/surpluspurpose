"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";
import { THEME_ACCENT_COOKIE, THEME_BASE_COOKIE, THEME_COOKIE, resolveTheme, type ThemeChoice } from "../lib/theme";

const OPTIONS: Array<{ id: ThemeChoice; label: string; hint: string }> = [
  { id: "light", label: "Light", hint: "Bright and clean" },
  { id: "dark", label: "Dark", hint: "Default" },
  { id: "contrast", label: "Dark contrast", hint: "Black, white, strong borders" },
  { id: "custom", label: "Custom", hint: "Your accent colour" }
];

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

/** Appearance settings: pick a theme; it applies at once and is remembered in a cookie. */
export function AppearancePanel({ accent, base, choice }: { accent: string; base: "light" | "dark"; choice: ThemeChoice }) {
  const router = useRouter();
  const [state, setState] = useState({ accent, base, choice });

  function apply(next: { accent: string; base: "light" | "dark"; choice: ThemeChoice }) {
    setState(next);
    writeCookie(THEME_COOKIE, next.choice);
    writeCookie(THEME_BASE_COOKIE, next.base);
    writeCookie(THEME_ACCENT_COOKIE, next.accent);

    // Update the page right away; the cookie keeps it for every later page.
    const theme = resolveTheme(next.choice, next.base, next.accent);
    const root = document.documentElement;
    root.dataset.spTheme = theme.effective;
    root.dataset.theme = theme.isDark ? "dark" : "light";
    root.classList.toggle("dark", theme.isDark);
    if (theme.accent) root.style.setProperty("--sp-accent-custom", theme.accent);
    else root.style.removeProperty("--sp-accent-custom");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <RadioGroup
          aria-label="Theme"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onValueChange={(value) => apply({ ...state, choice: value as ThemeChoice })}
          value={state.choice}
        >
          {OPTIONS.map((option) => (
            <Label
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors has-data-[state=checked]:border-primary has-data-[state=checked]:bg-accent"
              htmlFor={`theme-${option.id}`}
              key={option.id}
            >
              <RadioGroupItem className="mt-0.5" id={`theme-${option.id}`} value={option.id} />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs font-normal text-muted-foreground">{option.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>

        {state.choice === "custom" ? (
          <div className="flex flex-wrap items-center gap-6">
            <Label className="gap-3">
              Accent colour
              <input
                className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                onChange={(event) => apply({ ...state, accent: event.target.value })}
                type="color"
                value={state.accent}
              />
            </Label>
            <div className="flex items-center gap-2 text-sm font-medium">
              Base
              {(["light", "dark"] as const).map((value) => (
                <Button
                  aria-pressed={state.base === value}
                  key={value}
                  onClick={() => apply({ ...state, base: value })}
                  size="sm"
                  type="button"
                  variant={state.base === value ? "default" : "outline"}
                >
                  {value === "light" ? "Light" : "Dark"}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

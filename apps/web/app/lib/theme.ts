/** Appearance preference: stored in cookies so the server renders the right theme with no flash. */
export const THEME_COOKIE = "sp_theme";
export const THEME_BASE_COOKIE = "sp_theme_base";
export const THEME_ACCENT_COOKIE = "sp_accent";

export const THEME_CHOICES = ["light", "dark", "contrast", "custom"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = {
  choice: ThemeChoice;
  /** Light or dark base used by the "custom" choice. */
  base: "light" | "dark";
  /** What the page is actually rendered as. */
  effective: "light" | "dark" | "contrast";
  isDark: boolean;
  /** Custom accent colour (#rrggbb), only for the custom choice. */
  accent: string | undefined;
};

export function resolveTheme(choice?: string, base?: string, accent?: string): ResolvedTheme {
  const picked = (THEME_CHOICES as readonly string[]).includes(choice ?? "") ? (choice as ThemeChoice) : "dark";
  const customBase = base === "dark" ? "dark" : "light";
  const effective = picked === "custom" ? customBase : picked;

  return {
    choice: picked,
    base: customBase,
    effective,
    isDark: effective !== "light",
    accent: picked === "custom" && /^#[0-9a-fA-F]{6}$/.test(accent ?? "") ? accent : undefined
  };
}

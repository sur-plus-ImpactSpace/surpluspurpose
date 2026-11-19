import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { AppToaster } from "./components/AppToaster";
import { SiteFooter } from "./components/SiteFooter";
import { THEME_ACCENT_COOKIE, THEME_BASE_COOKIE, THEME_COOKIE, resolveTheme } from "./lib/theme";
import { cn } from "@/lib/utils";

/*
 * DM Sans, self-hosted via next/font/local: the build reads the files from disk
 * (no build-time fetch, no CDN at runtime), which keeps the app cookieless and EU-hosted.
 */
const sans = localFont({
  src: [
    { path: "../public/fonts/dm-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/dm-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/dm-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/dm-sans-latin-700-normal.woff2", weight: "700", style: "normal" }
  ],
  variable: "--font-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "sur.plus platform",
  description: "Operational workspace for corporate surplus matching with verified NGOs.",
  // The product app (app.surpluspurpose.com) is a login-gated tool — keep it out of the
  // index so only the marketing site (surpluspurpose.com) ranks. Flip this if /demo should
  // be discoverable via search.
  robots: { index: false, follow: true }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await cookies();
  const theme = resolveTheme(
    store.get(THEME_COOKIE)?.value,
    store.get(THEME_BASE_COOKIE)?.value,
    store.get(THEME_ACCENT_COOKIE)?.value
  );

  return (
    <html
      className={cn(sans.variable, "font-sans", theme.isDark && "dark")}
      data-sp-theme={theme.effective}
      data-theme={theme.isDark ? "dark" : "light"}
      lang="en"
      style={theme.accent ? ({ "--sp-accent-custom": theme.accent } as React.CSSProperties) : undefined}
    >
      <body>
        {children}
        <SiteFooter />
        <AppToaster theme={theme.isDark ? "dark" : "light"} />
      </body>
    </html>
  );
}

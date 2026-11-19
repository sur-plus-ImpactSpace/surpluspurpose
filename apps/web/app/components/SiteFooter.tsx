"use client";

import { usePathname } from "next/navigation";

// Full-screen LoginShell and workspace routes carry their own footer (Imprint ·
// Privacy), so the global site footer must not render there — otherwise the two
// footers appear twice on the same page.
const SHELL_ROUTES = ["/", "/login", "/registered", "/request-access", "/reset-password", "/demo", "/matches", "/inbox", "/listings", "/cases", "/needs", "/documents", "/impact", "/account", "/ops"];

export function SiteFooter() {
  const pathname = usePathname();
  const onShellRoute =
    pathname != null &&
    SHELL_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (onShellRoute) return null;

  return (
    <footer className="border-t border-border bg-card px-5 py-4 sm:px-8">
      <p className="mx-auto max-w-7xl text-xs text-muted-foreground">
        sur.plus · Every surplus has a purpose ·{" "}
        <a className="underline-offset-2 hover:underline" href="/imprint">
          Imprint
        </a>{" "}
        ·{" "}
        <a className="underline-offset-2 hover:underline" href="/privacy">
          Privacy
        </a>
      </p>
    </footer>
  );
}

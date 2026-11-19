import type { ReactNode } from "react";

/** Small breadcrumb at the top of a page (replaces the large title band); the title stays as a hidden h1. */
export function PageCrumb({ actions, current }: { actions?: ReactNode; current: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pt-5 sm:px-8 print:hidden">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-muted-foreground">
        <a className="hover:underline" href="/">
          Workspace
        </a>
        <span aria-hidden="true">/</span>
        <span className="font-medium text-foreground">{current}</span>
      </nav>
      <h1 className="sr-only">{current}</h1>
      {actions}
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Column = { label: string; align?: "right"; className?: string };
export type Row = {
  cells: ReactNode[];
  id: string;
  /** Text the search box matches against (names, e-mails...). */
  search?: string;
  /** Filter chip this row belongs to (e.g. "pending", "verified"). */
  status?: string;
};

/** One table style for every admin list. */
export function DataTable({
  columns,
  empty,
  rows,
  title
}: {
  columns: Column[];
  empty: string;
  rows: Row[];
  title: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) if (row.status) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);

    return [...counts.entries()];
  }, [rows]);
  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) => (status === "all" || row.status === status) && (!needle || (row.search ?? "").toLowerCase().includes(needle))
  );
  const searchable = rows.some((row) => row.search);

  // A click anywhere on a row (outside links and buttons) opens its review dialog.
  function openRow(event: React.MouseEvent<HTMLTableRowElement>) {
    // Dialog content is portalled but still bubbles through React: ignore anything outside the row itself.
    if (!event.currentTarget.contains(event.target as Node)) return;
    if ((event.target as HTMLElement).closest("a,button,input")) return;
    event.currentTarget.querySelector<HTMLButtonElement>("[data-row-open]")?.click();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
        {rows.length > 0 && (searchable || statuses.length > 1) ? (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {searchable ? (
              <div className="relative min-w-52 flex-1 sm:max-w-xs">
                <Search aria-hidden="true" className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label={`Search ${title}`} className="pl-8" onChange={(event) => setQuery(event.target.value)} placeholder="Search" value={query} />
              </div>
            ) : null}
            {statuses.length > 1 ? (
              <div className="flex flex-wrap gap-1">
                {[["all", rows.length] as const, ...statuses].map(([key, count]) => (
                  <button
                    aria-pressed={status === key}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-sm font-medium capitalize transition-colors",
                      status === key ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"
                    )}
                    key={key}
                    onClick={() => setStatus(key)}
                    type="button"
                  >
                    {key} <span className="text-xs text-muted-foreground">{count}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className={visible.length === 0 ? undefined : "px-0"}>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">{rows.length === 0 ? empty : "Nothing matches."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead className={cn("px-6", column.align === "right" && "text-right", column.className)} key={column.label}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <TableRow className="cursor-pointer" key={row.id} onClick={openRow}>
                  {row.cells.map((cell, index) => (
                    <TableCell className={cn("px-6 py-3", columns[index]?.align === "right" && "text-right", columns[index]?.className)} key={columns[index]?.label ?? index}>
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

const TONES = {
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: ""
} as const;

/** Small status badge used across the admin tables. */
export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <Badge className={cn("capitalize", TONES[tone])} variant={tone === "neutral" ? "secondary" : "outline"}>
      {children}
    </Badge>
  );
}

/** A name with a quieter second line, the first cell of most rows. */
export function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-foreground">{name}</p>
      {sub ? <p className="truncate text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

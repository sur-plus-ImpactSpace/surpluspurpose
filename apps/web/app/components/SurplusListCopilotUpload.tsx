"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { browserRouteHeaders } from "../lib/browser-supabase";
import { enrichWithCatalogIds } from "../lib/catalog-mapper";
import { categoryLabel, subcategoryLabel } from "../lib/catalog";
import type { Locale } from "../lib/i18n";
import type { SupabaseBrowserConfig } from "../lib/service-chat-realtime";

type Candidate = {
  title: string;
  category: string;
  subcategory: string;
  categoryId: string | null;
  subcategoryId: string | null;
  quantity: number;
  unit: string;
  unitValue: number;
  condition: string;
  weightKg: number;
  categoryDetails: string;
  city: string;
  country: string;
};

type RawKey =
  | "title"
  | "brand"
  | "model"
  | "category"
  | "subcategory"
  | "quantity"
  | "unit"
  | "unitValue"
  | "condition"
  | "year"
  | "purchaseDate"
  | "weight"
  | "city"
  | "country";

/**
 * Copilot surplus intake (first slice): a corporate uploads a CSV surplus list,
 * the Copilot drafts one listing candidate per row, and the corporate reviews
 * and approves before anything is created — AI proposes, human confirms. Parsing
 * is deterministic CSV for now; LLM parsing of messy/PDF lists is a later slice.
 * Creation reuses the proven POST /api/listings path (same as the manual form).
 */
const HEADER_MAP: Record<string, RawKey> = {
  title: "title",
  name: "title",
  item: "title",
  artikel: "title",
  bezeichnung: "title",
  brand: "brand",
  marke: "brand",
  hersteller: "brand",
  manufacturer: "brand",
  model: "model",
  modell: "model",
  category: "category",
  kategorie: "category",
  type: "category",
  typ: "category",
  subcategory: "subcategory",
  subkategorie: "subcategory",
  unterkategorie: "subcategory",
  quantity: "quantity",
  qty: "quantity",
  menge: "quantity",
  anzahl: "quantity",
  stueck: "quantity",
  unit: "unit",
  einheit: "unit",
  unit_value: "unitValue",
  unitvalue: "unitValue",
  value: "unitValue",
  wert: "unitValue",
  price: "unitValue",
  preis: "unitValue",
  condition: "condition",
  zustand: "condition",
  year: "year",
  baujahr: "year",
  jahr: "year",
  herstellungsjahr: "year",
  purchase_date: "purchaseDate",
  kaufdatum: "purchaseDate",
  purchased: "purchaseDate",
  anschaffungsdatum: "purchaseDate",
  weight: "weight",
  weight_kg: "weight",
  gewicht: "weight",
  gewicht_kg: "weight",
  city: "city",
  ort: "city",
  stadt: "city",
  country: "country",
  land: "country"
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toNumber(value: string): number {
  return Number(value.replace(/[^0-9.]/g, "")) || 0;
}

function parseCsv(text: string): Candidate[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const cols = parseCsvLine(lines[0]).map(
    (h) => HEADER_MAP[h.toLowerCase().replace(/\s+/g, "_")] ?? null
  );

  const candidates: Candidate[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    const rec: Partial<Record<RawKey, string>> = {};
    cols.forEach((key, i) => {
      if (key) rec[key] = cells[i] ?? "";
    });
    const get = (key: RawKey): string => (rec[key] ?? "").trim();
    const title = get("title") || [get("brand"), get("model")].filter(Boolean).join(" ");
    if (!title) continue;

    const details: string[] = [];
    if (get("brand")) details.push(`Brand: ${get("brand")}`);
    if (get("model")) details.push(`Model: ${get("model")}`);
    if (get("year")) details.push(`Year: ${get("year")}`);
    if (get("purchaseDate")) details.push(`Purchased: ${get("purchaseDate")}`);

    candidates.push({
      title,
      category: get("category") || "General",
      subcategory: get("subcategory"),
      categoryId: null,
      subcategoryId: null,
      quantity: Math.max(1, Math.round(toNumber(get("quantity")))),
      unit: get("unit") || "units",
      unitValue: Math.max(0, toNumber(get("unitValue"))),
      condition: get("condition") || "Good",
      weightKg: Math.max(0, toNumber(get("weight"))),
      categoryDetails: details.join(" · "),
      city: get("city"),
      country: get("country")
    });
  }
  // Resolve the free-text categories to stable catalogue ids for the DB/matching
  // while keeping the raw text on the record for display.
  return enrichWithCatalogIds(candidates);
}

export function SurplusListCopilotUpload({
  actorUserId,
  authConfig,
  locale = "de"
}: {
  actorUserId: string;
  authConfig: SupabaseBrowserConfig | null;
  locale?: Locale;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const missingSubcategory = candidates.filter((c) => !c.subcategoryId).length;

  function applyParsed(parsed: Candidate[]) {
    setCandidates(parsed);
    setStatus(
      parsed.length > 0
        ? `Copilot drafted ${parsed.length} listing${parsed.length === 1 ? "" : "s"} — review and send below.`
        : "No rows found. Expected a header row with columns like title, category, quantity, value."
    );
  }

  function onFile(file: File) {
    setStatus(null);
    const reader = new FileReader();
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      reader.onload = () => {
        void (async () => {
          try {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            applyParsed(sheet ? parseCsv(XLSX.utils.sheet_to_csv(sheet)) : []);
          } catch {
            setStatus("Could not read the spreadsheet.");
          }
        })();
      };
      reader.onerror = () => setStatus("Could not read the file.");
      reader.readAsArrayBuffer(file);
      return;
    }
    reader.onload = () => applyParsed(parseCsv(String(reader.result ?? "")));
    reader.onerror = () => setStatus("Could not read the file.");
    reader.readAsText(file);
  }

  async function sendToCopilot() {
    if (candidates.length === 0) return;
    setPending(true);
    setStatus(null);
    try {
      const headers = await browserRouteHeaders({
        config: authConfig,
        contentTypeJson: true,
        previewUserId: actorUserId
      });
      if (authConfig && !headers.authorization) {
        setStatus("Failed: auth_required");
        return;
      }

      const response = await fetch("/api/agent-runs", {
        method: "POST",
        headers: { ...headers, "idempotency-key": `copilot-intake-${actorUserId}-${Date.now()}` },
        body: JSON.stringify({
          taskType: "surplus_intake",
          title: "Surplus intake",
          prompt: JSON.stringify(candidates)
        })
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({ error: "invalid_response" }))) as {
          error?: string;
        };
        setStatus(`Failed: ${payload.error ?? response.status}`);
        return;
      }

      const sent = candidates.length;
      setCandidates([]);
      setStatus(
        `Sent ${sent} draft${sent === 1 ? "" : "s"} to the Copilot — approve each in the Loop panel below.`
      );
      router.refresh();
    } catch {
      setStatus("Failed: network_error");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <p
        className="text-xs font-medium"
      >
        Copilot intake
      </p>
      <h2 className="mt-2 text-xl font-semibold">Upload a surplus list</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Drop a CSV or Excel file of your surplus — use the template for the full format (title, brand, model,
        category, subcategory, quantity, unit, value, condition, year, purchase date, weight). The Copilot drafts a
        listing per row and sends them to the Loop panel, where you approve each before it is created.
      </p>

      <input
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          if (inputRef.current) inputRef.current.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} type="button">
          Choose file
        </Button>
        <a
          className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
          href="/surplus-template.xlsx"
        >
          Download template
        </a>
      </div>

      {candidates.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">{locale === "de" ? "Kategorie" : "Category"}</th>
                <th className="px-3 py-2 font-semibold">
                  {locale === "de" ? "Unterkategorie" : "Subcategory"}
                </th>
                <th className="px-3 py-2 font-semibold">Qty</th>
                <th className="px-3 py-2 font-semibold">Value</th>
                <th className="px-3 py-2 font-semibold">Condition</th>
                <th className="px-3 py-2 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => (
                <tr className="border-t border-border" key={`${c.title}-${i}`}>
                  <td className="px-3 py-2">{c.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {categoryLabel(c.categoryId ?? "other", locale)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.subcategoryId ? (
                      subcategoryLabel(c.categoryId ?? "other", c.subcategoryId, locale)
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400">
                        {locale === "de" ? "fehlt" : "missing"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{c.quantity}</td>
                  <td className="px-3 py-2 text-muted-foreground">€{c.unitValue.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.condition}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.categoryDetails}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {missingSubcategory > 0 ? (
        <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {locale === "de"
            ? `${missingSubcategory} ${missingSubcategory === 1 ? "Eintrag" : "Einträge"} ohne Unterkategorie — bitte in der Vorlage ergänzen (Unterkategorie ist Pflicht).`
            : `${missingSubcategory} ${missingSubcategory === 1 ? "entry" : "entries"} without a subcategory — please add it in the template (subcategory is required).`}
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-3">
        {candidates.length > 0 ? (
          <Button disabled={pending} onClick={() => void sendToCopilot()} type="button">
            {pending ? "Sending…" : `Send ${candidates.length} to Copilot`}
          </Button>
        ) : null}
        {status ? (
          <span className="text-xs text-muted-foreground" role="status">
            {status}
          </span>
        ) : null}
      </div>
    </section>
  );
}

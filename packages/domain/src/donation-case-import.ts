import type { DonationPositionCreateInput } from "./repository";

type RawKey = "category" | "model" | "quantity" | "condition" | "provenance" | "brand" | "title";

/**
 * Column aliases for CSV/Excel surplus lists (DE + EN). Mirrors the listing
 * copilot map, narrowed to CASE position fields (REQ-CORP-01).
 */
const HEADER_MAP: Record<string, RawKey> = {
  category: "category",
  kategorie: "category",
  type: "category",
  typ: "category",
  model: "model",
  modell: "model",
  title: "title",
  name: "title",
  item: "title",
  artikel: "title",
  bezeichnung: "title",
  brand: "brand",
  marke: "brand",
  hersteller: "brand",
  manufacturer: "brand",
  quantity: "quantity",
  qty: "quantity",
  menge: "quantity",
  anzahl: "quantity",
  stueck: "quantity",
  condition: "condition",
  zustand: "condition",
  provenance: "provenance",
  herkunft: "provenance",
  origin: "provenance",
  source: "provenance",
  quelle: "provenance"
};

export type DonationPositionCsvParseResult =
  | { ok: true; positions: DonationPositionCreateInput[] }
  | { ok: false; reason: "empty_csv" | "no_valid_rows" };

/**
 * Parse a CSV surplus list into donation position inputs. Pure: no I/O.
 * Rows missing required fields after mapping are skipped.
 */
export function parseDonationPositionCsv(text: string): DonationPositionCsvParseResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { ok: false, reason: "empty_csv" };

  const cols = parseCsvLine(lines[0]).map(
    (h) => HEADER_MAP[h.toLowerCase().replace(/\s+/g, "_")] ?? null
  );

  const positions: DonationPositionCreateInput[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    const rec: Partial<Record<RawKey, string>> = {};
    cols.forEach((key, i) => {
      if (key) rec[key] = cells[i] ?? "";
    });
    const get = (key: RawKey): string => (rec[key] ?? "").trim();

    const model =
      get("model") || [get("brand"), get("title")].filter(Boolean).join(" ").trim() || get("title");
    const category = get("category");
    const condition = get("condition");
    const provenance = get("provenance") || "Imported from CSV";
    const quantity = Math.round(toNumber(get("quantity")));

    if (!model || !category || !condition || quantity <= 0) continue;

    positions.push({
      category,
      model,
      quantity,
      condition,
      provenance
    });
  }

  if (positions.length === 0) return { ok: false, reason: "no_valid_rows" };
  return { ok: true, positions };
}

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

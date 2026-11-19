/**
 * Bridges free-text surplus lists (Excel/CSV uploads) to the stable two-level
 * category catalogue. Uploaders write whatever their internal systems call an
 * item ("IT & Elektronik", "Laptops", "Büromöbel"); the database stores stable
 * ids (`it_electronics`, `laptops`). This module maps the one onto the other
 * before rows become listing proposals, keeping the raw text around so the UI
 * can still show the uploader what they typed.
 *
 * Pure, side-effect-free logic so it stays unit-testable — no React, no fetch.
 */

import { CATEGORIES, subcategoriesFor, suggestCategory } from "./catalog";

const norm = (value: string): string => value.trim().toLowerCase();

/**
 * Map a free-text category (and, as a hint, the row title) to a stable category
 * id. Tries, in order: exact id match, localized label match (de/en), keyword
 * suggestion from the raw text, keyword suggestion from the title. Falls back to
 * `"other"` so every row always lands somewhere.
 */
export function mapToCategoryId(rawCategory: string, title: string): string {
  const raw = norm(rawCategory);

  if (raw) {
    // (a) exact id match, e.g. "it_electronics"
    const byId = CATEGORIES.find((category) => category.id === raw);
    if (byId) return byId.id;

    // (b) localized label match (case-insensitive, de or en)
    const byLabel = CATEGORIES.find(
      (category) => norm(category.de) === raw || norm(category.en) === raw
    );
    if (byLabel) return byLabel.id;

    // (c) keyword suggestion from the free-text category
    const fromCategory = suggestCategory(rawCategory);
    if (fromCategory) return fromCategory;
  }

  // (c, cont.) keyword suggestion from the title
  const fromTitle = suggestCategory(title);
  if (fromTitle) return fromTitle;

  return "other";
}

/**
 * Map a free-text subcategory to a stable subcategory id within the given
 * category. Tries exact id match, localized label match, then a keyword scan of
 * the raw text and title against the subcategory labels. Returns `null` when
 * nothing matches — the subcategory is mandatory, so the UI must flag the gap.
 * For the `"other"` category the only subcategory (`"other"`) is always used.
 */
export function mapToSubcategoryId(
  categoryId: string,
  rawSub: string,
  title: string
): string | null {
  const subs = subcategoriesFor(categoryId);
  if (subs.length === 0) return null;

  // "other" has exactly one subcategory; nothing to disambiguate.
  if (categoryId === "other") return subs[0]?.id ?? null;

  const raw = norm(rawSub);

  if (raw) {
    // Exact id match, e.g. "laptops"
    const byId = subs.find((sub) => sub.id === raw);
    if (byId) return byId.id;

    // Localized label match (de or en)
    const byLabel = subs.find((sub) => norm(sub.de) === raw || norm(sub.en) === raw);
    if (byLabel) return byLabel.id;
  }

  // Keyword fallback: does the raw text or title share a distinctive word with
  // a subcategory label? Both sides are reduced to stems (trailing "s"/"e"
  // dropped) so "Laptops & notebooks" matches a title mentioning "Laptop".
  const haystackStems = new Set(labelTokens(`${raw} ${norm(title)}`));
  const keyworded = subs.find((sub) =>
    labelTokens(`${sub.de} ${sub.en}`).some((token) => haystackStems.has(token))
  );
  if (keyworded) return keyworded.id;

  return null;
}

/** Distinctive word stems from a label (drops short/filler words, plural "s"/"e"). */
function labelTokens(label: string): string[] {
  return norm(label)
    .replace(/[()&/,.-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    .map((token) => token.replace(/(es|s|e)$/, ""));
}

const STOPWORDS = new Set([
  "und",
  "oder",
  "bitte",
  "material",
  "supplies",
  "equipment",
  "furniture",
  "goods"
]);

/** A row candidate as parsed from the upload, plus the resolved catalogue ids. */
export type CatalogEnriched<T extends { category: string; subcategory: string; title: string }> =
  T & {
    categoryId: string;
    subcategoryId: string | null;
  };

/** Resolve and attach `categoryId` + `subcategoryId` to a single candidate. */
export function enrichCandidate<
  T extends { category: string; subcategory: string; title: string }
>(candidate: T): CatalogEnriched<T> {
  const categoryId = mapToCategoryId(candidate.category, candidate.title);
  const subcategoryId = mapToSubcategoryId(categoryId, candidate.subcategory, candidate.title);

  return { ...candidate, categoryId, subcategoryId };
}

/** Enrich a list of candidates in place-preserving order. */
export function enrichWithCatalogIds<
  T extends { category: string; subcategory: string; title: string }
>(candidates: T[]): CatalogEnriched<T>[] {
  return candidates.map(enrichCandidate);
}

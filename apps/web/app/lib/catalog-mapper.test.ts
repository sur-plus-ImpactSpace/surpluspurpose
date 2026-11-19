import { describe, expect, it } from "vitest";
import {
  enrichCandidate,
  enrichWithCatalogIds,
  mapToCategoryId,
  mapToSubcategoryId
} from "./catalog-mapper";

describe("mapToCategoryId", () => {
  it("matches a stable id exactly", () => {
    expect(mapToCategoryId("it_electronics", "")).toBe("it_electronics");
  });

  it("matches a German label case-insensitively", () => {
    expect(mapToCategoryId("IT & Elektronik", "")).toBe("it_electronics");
    expect(mapToCategoryId("  büro & einrichtung  ", "")).toBe("office_furniture");
  });

  it("matches an English label case-insensitively", () => {
    expect(mapToCategoryId("Textiles & clothing", "")).toBe("textiles_clothing");
  });

  it("falls back to keyword suggestion on the free-text category", () => {
    expect(mapToCategoryId("Notebooks", "")).toBe("it_electronics");
  });

  it("falls back to keyword suggestion on the title when category is unhelpful", () => {
    expect(mapToCategoryId("Diverses", "Gebrauchter Bürostuhl")).toBe("office_furniture");
  });

  it("returns 'other' when nothing matches", () => {
    expect(mapToCategoryId("zzz-unknown", "mysterious thing")).toBe("other");
    expect(mapToCategoryId("", "")).toBe("other");
  });
});

describe("mapToSubcategoryId", () => {
  it("matches a subcategory id exactly", () => {
    expect(mapToSubcategoryId("it_electronics", "laptops", "")).toBe("laptops");
  });

  it("matches a subcategory label", () => {
    expect(mapToSubcategoryId("it_electronics", "Laptops & notebooks", "")).toBe("laptops");
    expect(mapToSubcategoryId("office_furniture", "Bürostühle", "")).toBe("office_chairs");
  });

  it("falls back to a keyword in the raw text or title", () => {
    expect(mapToSubcategoryId("it_electronics", "", "Dell Laptop 14 Zoll")).toBe("laptops");
  });

  it("always resolves the single subcategory for 'other'", () => {
    expect(mapToSubcategoryId("other", "", "")).toBe("other");
    expect(mapToSubcategoryId("other", "whatever", "anything")).toBe("other");
  });

  it("returns null when the subcategory cannot be determined", () => {
    expect(mapToSubcategoryId("it_electronics", "", "")).toBeNull();
    expect(mapToSubcategoryId("it_electronics", "gibberish", "gibberish")).toBeNull();
  });

  it("returns null for an unknown category id (no subcategories)", () => {
    expect(mapToSubcategoryId("does_not_exist", "laptops", "")).toBeNull();
  });
});

describe("enrichCandidate / enrichWithCatalogIds", () => {
  const base = {
    title: "",
    category: "",
    subcategory: "",
    quantity: 1
  };

  it("attaches category and subcategory ids while keeping the raw text", () => {
    const enriched = enrichCandidate({
      ...base,
      title: "Dell Latitude",
      category: "IT & Elektronik",
      subcategory: "Laptops"
    });

    expect(enriched.categoryId).toBe("it_electronics");
    expect(enriched.subcategoryId).toBe("laptops");
    // Raw text is preserved for display.
    expect(enriched.category).toBe("IT & Elektronik");
    expect(enriched.subcategory).toBe("Laptops");
  });

  it("resolves the subcategory from a title keyword when the column is blank", () => {
    const enriched = enrichCandidate({
      ...base,
      title: "HDMI Kabel Zubehör",
      category: "IT & Elektronik",
      subcategory: ""
    });

    expect(enriched.categoryId).toBe("it_electronics");
    // "kabel"/"zubehör" match the accessories & cables subcategory.
    expect(enriched.subcategoryId).toBe("accessories_cables");
  });

  it("maps unknown rows to other/other", () => {
    const enriched = enrichCandidate({
      ...base,
      title: "mysterious widget",
      category: "???",
      subcategory: ""
    });

    expect(enriched.categoryId).toBe("other");
    expect(enriched.subcategoryId).toBe("other");
  });

  it("preserves order across a list", () => {
    const list = enrichWithCatalogIds([
      { ...base, title: "A", category: "Laptops", subcategory: "" },
      { ...base, title: "B", category: "Bürostühle", subcategory: "" }
    ]);

    expect(list.map((entry) => entry.categoryId)).toEqual(["it_electronics", "office_furniture"]);
  });
});

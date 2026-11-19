/**
 * The shared vocabulary for what moves through sur.plus. Listings and needs
 * must speak the same categories or matching has to translate between two
 * lists — this module is the single source for both forms and every place that
 * displays a category.
 *
 * Each category and subcategory has a **stable id** (stored in the database)
 * and localized labels (shown in the UI). Storing the id, not the label, keeps
 * matching robust and lets the same item read "IT & Elektronik" or
 * "IT & electronics" depending on the viewer's language. Use `categoryLabel` /
 * `subcategoryLabel` to render — they fall back to the raw stored value for
 * legacy free-text or unknown ids, so nothing ever renders blank.
 *
 * Categories are aligned with the NGO Partner Agreement's matching profile and
 * the two-level catalogues used by established in-kind platforms (Good360,
 * In Kind Direct, Innatura). v2 (2026-08): finer, two-level, with a mandatory
 * subcategory for precise matching.
 */

import type { Locale } from "./i18n";

export type Subcategory = { id: string; de: string; en: string };
export type Category = { id: string; de: string; en: string; subs: Subcategory[] };

export const CATEGORIES: readonly Category[] = [
  {
    id: "it_electronics",
    de: "IT & Elektronik",
    en: "IT & electronics",
    subs: [
      { id: "laptops", de: "Laptops & Notebooks", en: "Laptops & notebooks" },
      { id: "desktops_monitors", de: "Desktop-PCs & Monitore", en: "Desktop PCs & monitors" },
      { id: "tablets_phones", de: "Tablets & Smartphones", en: "Tablets & smartphones" },
      { id: "servers_network", de: "Server & Netzwerk", en: "Servers & networking" },
      { id: "printers_peripherals", de: "Drucker & Peripherie", en: "Printers & peripherals" },
      { id: "consumer_electronics", de: "Unterhaltungselektronik", en: "Consumer electronics" },
      { id: "accessories_cables", de: "Zubehör & Kabel", en: "Accessories & cables" }
    ]
  },
  {
    id: "office_furniture",
    de: "Büro & Einrichtung",
    en: "Office & furniture",
    subs: [
      { id: "desks", de: "Schreibtische & Arbeitsplätze", en: "Desks & workstations" },
      { id: "office_chairs", de: "Bürostühle", en: "Office chairs" },
      { id: "cabinets_shelving", de: "Schränke & Regale", en: "Cabinets & shelving" },
      { id: "conference_lounge", de: "Konferenz- & Aufenthaltsmöbel", en: "Conference & lounge furniture" },
      { id: "lighting", de: "Beleuchtung", en: "Lighting" },
      { id: "office_supplies", de: "Bürobedarf & Papierwaren", en: "Office & paper supplies" }
    ]
  },
  {
    id: "textiles_clothing",
    de: "Textilien & Kleidung",
    en: "Textiles & clothing",
    subs: [
      { id: "outerwear", de: "Oberbekleidung (Jacken/Mäntel)", en: "Outerwear (jackets/coats)" },
      { id: "everyday_clothing", de: "Alltagskleidung", en: "Everyday clothing" },
      { id: "workwear_ppe", de: "Arbeits- & Schutzkleidung", en: "Workwear & protective clothing" },
      { id: "footwear", de: "Schuhe", en: "Footwear" },
      { id: "kids_baby_clothing", de: "Kinder- & Babykleidung", en: "Children's & baby clothing" },
      { id: "home_textiles", de: "Heimtextilien (Decken, Bettwäsche)", en: "Home textiles (blankets, bedding)" }
    ]
  },
  {
    id: "household_appliances",
    de: "Haushalt & Geräte",
    en: "Household & appliances",
    subs: [
      { id: "large_appliances", de: "Großgeräte (Kühlschrank, Waschmaschine)", en: "Large appliances (fridge, washer)" },
      { id: "small_appliances", de: "Kleingeräte", en: "Small appliances" },
      { id: "kitchenware", de: "Geschirr & Küche", en: "Kitchenware" },
      { id: "home_furniture", de: "Wohnmöbel", en: "Home furniture" },
      { id: "cleaning_equipment", de: "Reinigungsausstattung", en: "Cleaning equipment" }
    ]
  },
  {
    id: "tools_equipment",
    de: "Werkzeug & Ausrüstung",
    en: "Tools & equipment",
    subs: [
      { id: "hand_tools", de: "Handwerkzeug", en: "Hand tools" },
      { id: "power_tools", de: "Elektrowerkzeug", en: "Power tools" },
      { id: "ladders_scaffolding", de: "Leitern & Gerüste", en: "Ladders & scaffolding" },
      { id: "garden_outdoor", de: "Garten- & Außengeräte", en: "Garden & outdoor equipment" },
      { id: "safety_ppe", de: "Schutzausrüstung (PSA)", en: "Safety equipment (PPE)" }
    ]
  },
  {
    id: "building_materials",
    de: "Baumaterial",
    en: "Building materials",
    subs: [
      { id: "wood_panels", de: "Holz & Platten", en: "Wood & panels" },
      { id: "paints_coatings", de: "Farben & Lacke", en: "Paints & coatings" },
      { id: "insulation_drywall", de: "Dämmung & Trockenbau", en: "Insulation & drywall" },
      { id: "flooring_tiles", de: "Bodenbeläge & Fliesen", en: "Flooring & tiles" },
      { id: "sanitary_plumbing", de: "Sanitär & Installation", en: "Sanitary & plumbing" },
      { id: "fittings_hardware", de: "Beschläge & Kleinteile", en: "Fittings & hardware" }
    ]
  },
  {
    id: "education_learning",
    de: "Bildung & Lernen",
    en: "Education & learning",
    subs: [
      { id: "books_teaching", de: "Bücher & Lehrmaterial", en: "Books & teaching material" },
      { id: "school_craft", de: "Schul- & Bastelbedarf", en: "School & craft supplies" },
      { id: "presentation_tech", de: "Präsentationstechnik (Beamer, Whiteboard)", en: "Presentation tech (projector, whiteboard)" },
      { id: "play_learning", de: "Spiel- & Lernmaterial", en: "Play & learning material" },
      { id: "musical_instruments", de: "Musikinstrumente", en: "Musical instruments" }
    ]
  },
  {
    id: "food_beverages",
    de: "Lebensmittel & Getränke (haltbar)",
    en: "Food & beverages (non-perishable)",
    subs: [
      { id: "canned_dry", de: "Konserven & Trockenware", en: "Canned & dry goods" },
      { id: "beverages", de: "Getränke", en: "Beverages" },
      { id: "baby_food", de: "Baby- & Säuglingsnahrung", en: "Baby & infant food" },
      { id: "staple_foods", de: "Grundnahrungsmittel", en: "Staple foods" }
    ]
  },
  {
    id: "medical_care",
    de: "Medizin & Pflege",
    en: "Medical & care supplies",
    subs: [
      { id: "consumables", de: "Verbrauchsmaterial (Verband, Handschuhe)", en: "Consumables (dressings, gloves)" },
      { id: "mobility_aids", de: "Mobilitätshilfen (Rollstuhl, Rollator)", en: "Mobility aids (wheelchair, walker)" },
      { id: "care_supplies", de: "Pflegebedarf", en: "Care supplies" },
      { id: "first_aid", de: "Erste-Hilfe-Ausstattung", en: "First-aid equipment" }
    ]
  },
  {
    id: "hygiene_personal_care",
    de: "Hygiene & Drogerie",
    en: "Hygiene & personal care",
    subs: [
      { id: "body_care", de: "Körperpflege (Seife, Shampoo)", en: "Body care (soap, shampoo)" },
      { id: "feminine_hygiene", de: "Damenhygiene", en: "Feminine hygiene" },
      { id: "baby_care", de: "Baby-Pflege (Windeln)", en: "Baby care (diapers)" },
      { id: "cleaning_detergents", de: "Reinigungs- & Waschmittel", en: "Cleaning agents & detergents" }
    ]
  },
  {
    id: "other",
    de: "Sonstiges",
    en: "Other",
    subs: [{ id: "other", de: "Sonstiges (bitte im Detailfeld beschreiben)", en: "Other (describe in the details field)" }]
  }
] as const;

/** Where sur.plus operates today (LP: EU, UK, Norway, Switzerland). */
export const COUNTRIES = [
  "Germany",
  "Austria",
  "Switzerland",
  "Netherlands",
  "Belgium",
  "France",
  "Italy",
  "Spain",
  "Portugal",
  "Poland",
  "Czechia",
  "Slovakia",
  "Denmark",
  "Sweden",
  "Norway",
  "Finland",
  "Ireland",
  "Luxembourg",
  "United Kingdom",
  "Other (Europe)"
] as const;

/** The localized label for a stored category id (falls back to the raw value). */
export function categoryLabel(id: string, locale: Locale): string {
  const category = CATEGORIES.find((item) => item.id === id);

  return category ? category[locale] : id;
}

/** The localized label for a stored subcategory id (falls back to the raw value). */
export function subcategoryLabel(categoryId: string, subId: string, locale: Locale): string {
  const category = CATEGORIES.find((item) => item.id === categoryId);
  const sub = category?.subs.find((item) => item.id === subId);

  return sub ? sub[locale] : subId;
}

/** The subcategories available for a given category id (empty if unknown). */
export function subcategoriesFor(categoryId: string): readonly Subcategory[] {
  return CATEGORIES.find((item) => item.id === categoryId)?.subs ?? [];
}

/** Keyword -> category id. First match wins; checked lowercase, DE + EN. */
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/laptop|notebook|monitor|bildschirm|server|tablet|computer|pc\b|drucker|printer|smartphone|handy|iphone|it[- ]/i, "it_electronics"],
  [/stuhl|stühle|chair|desk|schreibtisch|tisch|table|regal|shelf|schrank|möbel|furniture|sofa/i, "office_furniture"],
  [/jacke|kleidung|textil|shirt|hose|clothing|workwear|schuhe|shoes|decke|blanket/i, "textiles_clothing"],
  [/kühlschrank|fridge|waschmaschine|washing|geschirr|haushalts|appliance|mikrowelle|microwave/i, "household_appliances"],
  [/werkzeug|tool|bohr|drill|säge|saw|leiter|ladder/i, "tools_equipment"],
  [/holz|wood|zement|cement|baumaterial|building|ziegel|brick|farbe|paint|dämm/i, "building_materials"],
  [/buch|book|lernmaterial|schulmaterial|educational|whiteboard|beamer|projektor|projector/i, "education_learning"],
  [/lebensmittel|food|getränk|beverage|konserve/i, "food_beverages"],
  [/medizin|medical|verband|pflege|healthcare|rollstuhl|wheelchair/i, "medical_care"],
  [/seife|soap|shampoo|hygiene|windel|diaper|waschmittel|detergent|drogerie/i, "hygiene_personal_care"]
];

/** Best-guess category id from a free-text title, or null if nothing matches. */
export function suggestCategory(title: string): string | null {
  const match = CATEGORY_KEYWORDS.find(([pattern]) => pattern.test(title));

  return match ? match[1] : null;
}

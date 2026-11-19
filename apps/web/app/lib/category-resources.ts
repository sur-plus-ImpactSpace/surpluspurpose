import type { Locale } from "./i18n";

/**
 * Category-conditional enrichment for the receiving NGO: practical, no-strings
 * pointers to get the most out of a delivery. Shown ONLY for categories where
 * it helps — IT gets a free/open-source software pack (which also deepens the
 * E5 reuse story: donated hardware stays productive for longer). Furniture,
 * textiles and tools get short handling tips. Unknown categories show nothing.
 *
 * Bilingual by design (DE/EN); resource names are proper nouns and stay as-is.
 */
export type CategoryResourceItem = {
  name: string;
  url?: string;
  note: Record<Locale, string>;
};

export type CategoryResourceKind = "it" | "furniture" | "textiles" | "tools";

export type CategoryResourceGroup = {
  kind: CategoryResourceKind;
  intro: Record<Locale, string>;
  items: CategoryResourceItem[];
};

const IT_GROUP: CategoryResourceGroup = {
  kind: "it",
  intro: {
    en: "Free, open-source software to revive donated hardware and equip your team — no licence cost, and it keeps older machines useful for years longer.",
    de: "Kostenlose Open-Source-Software, um gespendete Hardware wiederzubeleben und euer Team auszustatten — ohne Lizenzkosten, und ältere Geräte bleiben jahrelang länger nutzbar."
  },
  items: [
    {
      name: "Linux Mint",
      url: "https://linuxmint.com",
      note: { en: "Revive laptops/desktops that no longer run current Windows.", de: "Belebt Laptops/PCs, die kein aktuelles Windows mehr unterstützen." }
    },
    {
      name: "ChromeOS Flex",
      url: "https://chromeenterprise.google/os/chromeosflex/",
      note: { en: "Turn very old machines into fast, secure Chromebooks.", de: "Macht sehr alte Geräte zu schnellen, sicheren Chromebooks." }
    },
    {
      name: "LibreOffice",
      url: "https://www.libreoffice.org",
      note: { en: "Full office suite — documents, spreadsheets, presentations.", de: "Komplettes Office-Paket — Texte, Tabellen, Präsentationen." }
    },
    {
      name: "Thunderbird",
      url: "https://www.thunderbird.net",
      note: { en: "Email, calendar and contacts in one place.", de: "E-Mail, Kalender und Kontakte an einem Ort." }
    },
    {
      name: "Nextcloud",
      url: "https://nextcloud.com",
      note: { en: "Shared files, calendar and collaboration.", de: "Gemeinsame Dateien, Kalender und Zusammenarbeit." }
    },
    {
      name: "Jitsi Meet",
      url: "https://meet.jit.si",
      note: { en: "Video calls, no account needed.", de: "Videocalls, ohne Konto." }
    },
    {
      name: "Bitwarden",
      url: "https://bitwarden.com",
      note: { en: "Password manager for the whole team.", de: "Passwortmanager fürs ganze Team." }
    },
    {
      name: "CiviCRM",
      url: "https://civicrm.org",
      note: { en: "Donor and contact management built for non-profits.", de: "Spender- und Kontaktverwaltung, gebaut für gemeinnützige Organisationen." }
    }
  ]
};

const FURNITURE_GROUP: CategoryResourceGroup = {
  kind: "furniture",
  intro: {
    en: "A few pointers to get this furniture in service quickly and safely.",
    de: "Ein paar Hinweise, um diese Möbel schnell und sicher in Betrieb zu nehmen."
  },
  items: [
    { name: "Assembly & parts", note: { en: "Photograph fixings before disassembly; keep screws bagged per item for a smooth rebuild.", de: "Beschläge vor dem Zerlegen fotografieren; Schrauben je Möbelstück beutelweise sammeln." } },
    { name: "Quick refurbishment", note: { en: "Felt pads, tightened fixings and a wipe-down extend usable life at near-zero cost.", de: "Filzgleiter, nachgezogene Schrauben und Reinigung verlängern die Nutzung nahezu kostenlos." } }
  ]
};

const TEXTILES_GROUP: CategoryResourceGroup = {
  kind: "textiles",
  intro: {
    en: "Handling notes so textiles reach the people who need them in good condition.",
    de: "Hinweise, damit Textilien in gutem Zustand bei den Menschen ankommen."
  },
  items: [
    { name: "Sort by size & season", note: { en: "Label boxes by size and season on intake — it saves hours at distribution.", de: "Kartons bei Annahme nach Größe und Saison beschriften — spart Stunden bei der Ausgabe." } },
    { name: "Hygiene", note: { en: "Launder or steam before distribution; set aside anything damaged for recycling.", de: "Vor Ausgabe waschen oder dämpfen; Beschädigtes fürs Recycling aussortieren." } }
  ]
};

const TOOLS_GROUP: CategoryResourceGroup = {
  kind: "tools",
  intro: {
    en: "Safety and upkeep so tools stay usable and safe to lend out.",
    de: "Sicherheit und Pflege, damit Werkzeuge nutzbar und sicher verleihbar bleiben."
  },
  items: [
    { name: "Safety check", note: { en: "Inspect cables, guards and blades before first use; tag anything unsafe.", de: "Kabel, Schutzvorrichtungen und Klingen vor Erstnutzung prüfen; Unsicheres kennzeichnen." } },
    { name: "Basic upkeep", note: { en: "Clean, oil moving parts and store dry to prevent rust.", de: "Reinigen, bewegliche Teile ölen und trocken lagern gegen Rost." } }
  ]
};

/** Resolve a listing category string to its resource group, or null if none applies. */
export function resolveCategoryResources(category: string | null | undefined): CategoryResourceGroup | null {
  const c = (category ?? "").toLowerCase();
  if (!c) return null;
  if (/\b(it|hardware|laptop|computer|electronic|monitor|server|printer|device)s?\b/.test(c)) return IT_GROUP;
  if (/(furniture|desk|chair|table|möbel|shelv)/.test(c)) return FURNITURE_GROUP;
  if (/(textile|cloth|clothing|apparel|kleidung|garment)/.test(c)) return TEXTILES_GROUP;
  if (/(tool|werkzeug|equipment)/.test(c)) return TOOLS_GROUP;
  return null;
}

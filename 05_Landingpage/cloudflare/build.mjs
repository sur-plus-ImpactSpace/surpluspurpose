import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Baut das Asset-Verzeichnis für den Landingpage-Worker.
 *
 * Die Website selbst bleibt unverändert in ../Online liegen — sie ist weiterhin
 * die einzige Quelle, auch solange Netlify parallel läuft. Dieser Schritt
 * erzeugt daraus eine Kopie mit zwei Unterschieden:
 *
 *   1. netlify/ fliegt raus. Der Funktionscode wird vom Worker importiert, er
 *      gehört nicht in die ausgelieferten Assets.
 *   2. _redirects wird übersetzt. Netlify markiert erzwungene Weiterleitungen
 *      mit "301!" — bei Cloudflare ist das keine gültige Zeile und würde
 *      stillschweigend ignoriert, die Weiterleitung fiele also aus. Cloudflare
 *      folgt Weiterleitungen ohnehin immer vor einer vorhandenen Datei, das "!"
 *      ist dort schlicht die Voreinstellung.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, "..", "Online");
const dist = path.join(here, "dist");

const CF_REDIRECT_LIMIT_STATIC = 2000;
const CF_REDIRECT_LIMIT_DYNAMIC = 100;

async function main() {
  if (!existsSync(source)) throw new Error(`Quelle fehlt: ${source}`);

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(source, dist, {
    recursive: true,
    filter: (src) => !src.split(path.sep).includes("netlify")
  });

  const redirectsPath = path.join(dist, "_redirects");
  if (existsSync(redirectsPath)) {
    const original = await readFile(redirectsPath, "utf8");
    const converted = original
      .split("\n")
      .map((line) => (line.trimStart().startsWith("#") ? line : line.replace(/\b(30[1278]|200)!/g, "$1")))
      .join("\n");

    const rules = converted
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    const dynamic = rules.filter((l) => l.includes("*") || /\s:[a-z]/i.test(l));

    if (rules.length - dynamic.length > CF_REDIRECT_LIMIT_STATIC || dynamic.length > CF_REDIRECT_LIMIT_DYNAMIC) {
      throw new Error(
        `Zu viele Weiterleitungen für Cloudflare: ${rules.length - dynamic.length} statisch, ${dynamic.length} dynamisch`
      );
    }

    // Cloudflare wertet statische Regeln schneller aus, wenn sie vor den
    // Regeln mit Platzhaltern stehen; wrangler warnt sonst zeilenweise.
    const lines = converted.split("\n");
    const isDynamic = (l) => {
      const t = l.trim();
      return t && !t.startsWith("#") && (t.includes("*") || /\s:[a-z]/i.test(t));
    };
    const ordered = [
      ...lines.filter((l) => !isDynamic(l)),
      "",
      "# Ab hier Regeln mit Platzhaltern — von build.mjs ans Ende sortiert, weil",
      "# Cloudflare statische Weiterleitungen davor schneller auswertet.",
      ...lines.filter(isDynamic)
    ].join("\n");

    await writeFile(redirectsPath, ordered, "utf8");
    console.log(`_redirects übersetzt — ${rules.length - dynamic.length} statisch, ${dynamic.length} dynamisch`);
  }

  console.log(`Assets gebaut: ${path.relative(process.cwd(), dist)}`);
}

await main();

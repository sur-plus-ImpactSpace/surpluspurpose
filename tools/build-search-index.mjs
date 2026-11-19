#!/usr/bin/env node
/* sur.plus — build-search-index.mjs
 *
 * Erzeugt die clientseitigen Suchindizes für das Such-Widget (search.js):
 *   05_Landingpage/Online/search-index.de.json
 *   05_Landingpage/Online/search-index.en.json
 *
 * Quelle: alle statischen HTML-Seiten der Landing Page (LP, FAQ, Ratgeber,
 * Guides, Case Studies, Rechner). Extrahiert werden:
 *   - FAQ-Einträge aus dem FAQPage-JSON-LD (beste Antwort-Qualität)
 *   - Abschnitte (h1–h4 + Folgetext) mit Anker-Link, wo vorhanden
 *   - Seitentitel + Meta-Description als Seiteneintrag
 *
 * Keine Abhängigkeiten — reines Node (>=18). Aufruf aus dem Repo-Root:
 *   node tools/build-search-index.mjs
 *
 * Nach jeder Inhaltsänderung an der LP einmal laufen lassen (oder als
 * Netlify-Build-Step: command = "node tools/build-search-index.mjs").
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '05_Landingpage', 'Online');

// Seiten, die nicht in die Suche gehören
const SKIP = new Set([
  '404.html',
  'index.html',   // 2026-10-03: Root ist nur noch Redirect-Stub auf /de/, EN-Home liegt unter en/
  'chat-ops.html',
  'CSRD_Report_Q1Q2_2026.html',
  'NGO_Partner_Agreement_surplus.html',
  'de/CSRD_Report_Q1Q2_2026.html',
  'de/NGO_Partner_Agreement_surplus.html'
]);

const MAX_TEXT = 900;   // Zeichen pro Eintrag (Matching + Snippet)
const MIN_TEXT = 40;    // kürzere Abschnitte werden verworfen

/* ---------- HTML-Helfer (regex-basiert; die LP-Seiten sind eigene,
 * wohlgeformte Templates — dafür reicht das und spart jede Dependency) */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  middot: '·', ndash: '–', mdash: '—', hellip: '…', rarr: '→', larr: '←',
  eur: '€', euro: '€', sect: '§', copy: '©', reg: '®', trade: '™',
  ldquo: '“', rdquo: '”', bdquo: '„', lsquo: '‘', rsquo: '’', deg: '°'
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m);
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function stripNoise(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

function pageTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).replace(/\s*[|·—-]\s*sur\.plus.*$/i, '').trim() : '';
}

function metaDescription(html) {
  const m =
    html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
    html.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

/* ---------- Extraktion */

function extractFaqLd(html, url) {
  const out = [];
  const re = /<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const nodes = Array.isArray(data) ? data : data['@graph'] || [data];
    for (const node of nodes) {
      if (node && node['@type'] === 'FAQPage' && Array.isArray(node.mainEntity)) {
        for (const q of node.mainEntity) {
          const question = stripTags(String(q.name || ''));
          const answer = stripTags(String(q.acceptedAnswer?.text || ''));
          if (question && answer) {
            out.push({ k: 'faq', t: question, x: answer.slice(0, MAX_TEXT), u: url + '#faq' });
          }
        }
      }
    }
  }
  return out;
}

function extractSections(html, url, title) {
  const clean = stripNoise(html);
  const body = (clean.match(/<body[\s\S]*<\/body>/i) || [clean])[0];

  // Positionen aller id="…" merken (für den nächstgelegenen Anker vor einer Überschrift)
  const ids = [];
  const idRe = /<(?:section|div|article|main|h[1-4])\b[^>]*\bid=["']([^"']+)["']/gi;
  let im;
  while ((im = idRe.exec(body))) ids.push({ pos: im.index, id: im[1] });

  const heads = [];
  const hRe = /<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hm;
  while ((hm = hRe.exec(body))) {
    heads.push({ pos: hm.index, end: hm.index + hm[0].length, level: +hm[1], text: stripTags(hm[2]) });
  }

  const out = [];
  for (let i = 0; i < heads.length; i++) {
    const h = heads[i];
    if (!h.text || h.text.length < 3) continue;
    const chunk = body.slice(h.end, heads[i + 1] ? heads[i + 1].pos : h.end + 12000);
    const text = stripTags(chunk).slice(0, MAX_TEXT);
    if (text.length < MIN_TEXT) continue;
    let anchor = '';
    for (const { pos, id } of ids) { if (pos <= h.pos) anchor = id; else break; }
    out.push({ k: 's', t: h.text, x: text, u: url + (anchor ? '#' + anchor : ''), p: title });
  }
  return out;
}

// Ein Eintrag pro <section id="…">: Kicker + H2 als Titel, Sektions-Text als Inhalt.
// Fängt Fälle wie die Pricing-Sektion ab, wo das Schlüsselwort („Preise") im
// Kicker VOR der Überschrift steht und sonst im vorigen Abschnitt landen würde.
function extractTopSections(html, url, title) {
  const clean = stripNoise(html);
  const body = (clean.match(/<body[\s\S]*<\/body>/i) || [clean])[0];
  const out = [];
  const re = /<section\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi;
  const marks = [];
  let m;
  while ((m = re.exec(body))) marks.push({ pos: m.index, end: m.index + m[0].length, id: m[1] });
  for (let i = 0; i < marks.length; i++) {
    const seg = body.slice(marks[i].end, marks[i + 1] ? marks[i + 1].pos : marks[i].end + 20000);
    const kickerRaw = (seg.match(/class=["'][^"']*kicker[^"']*["'][^>]*>([\s\S]{0,500}?)(?=<h[1-3]\b|<\/div>)/i) || [])[1];
    const kicker = kickerRaw && stripTags(kickerRaw).replace(/^\d+\s*/, '');
    const h2 = (seg.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i) || [])[1];
    const t = [kicker, h2 && stripTags(h2)].filter(Boolean).join(' — ');
    if (!t) continue;
    const text = stripTags(seg).replace(/^\d{1,2}\s+/, '').slice(0, MAX_TEXT);
    if (text.length < MIN_TEXT) continue;
    const entry = { k: 's', t, x: text, u: url + '#' + marks[i].id, p: title };
    // Unsichtbare Zusatz-Keywords für Frage-Intents, die Besucher wörtlich so
    // eintippen (fließen ins Matching ein, erscheinen aber nicht im Snippet)
    if (marks[i].id === 'pricing') {
      entry.kw = 'Was kostet sur.plus? What does sur.plus cost? Preise Pläne Kosten pricing cost plans Pulse Seed Tree Clearance';
    }
    out.push(entry);
  }
  return out;
}

// Preis-Plan-Karten (Pulse/Seed/Tree/Clearance): Name steht in .plan-tier,
// nicht in einer Überschrift — eigene Einträge, damit "Seed Plan" etc. trifft.
function extractPlanCards(html, url) {
  const clean = stripNoise(html);
  const body = (clean.match(/<body[\s\S]*<\/body>/i) || [clean])[0];
  const out = [];
  const marks = [];
  const re = /<(div|article)\b[^>]*class=["']plan["']/gi;
  let m;
  while ((m = re.exec(body))) marks.push(m.index);
  for (let i = 0; i < marks.length; i++) {
    const seg = body.slice(marks[i], marks[i + 1] || marks[i] + 7000);
    const tier = (seg.match(/plan-tier["'][^>]*>([\s\S]{0,200}?)<\//i) || [])[1];
    if (!tier) continue;
    const name = stripTags(tier);
    const text = stripTags(seg).slice(0, 700);
    if (!name || text.length < MIN_TEXT) continue;
    out.push({ k: 's', t: name + ' – Plan', x: text, u: url + '#pricing' });
  }
  return out;
}

function urlFor(relPath) {
  let u = '/' + relPath.split(sep).join('/');
  u = u.replace(/index\.html$/, '');
  return u;
}

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (['netlify', 'fonts', 'img'].includes(name)) continue;
      yield* htmlFiles(p);
    } else if (name.endsWith('.html')) {
      yield p;
    }
  }
}

/* ---------- Build */

const docs = { de: [], en: [] };
let pages = 0;

for (const file of htmlFiles(ROOT)) {
  const rel = relative(ROOT, file);
  const relUnix = rel.split(sep).join('/');
  if (SKIP.has(relUnix)) continue;

  const html = readFileSync(file, 'utf8');
  const lang = relUnix === 'de' || relUnix.startsWith('de/') ? 'de' : 'en';
  const url = urlFor(rel);
  const title = pageTitle(html);
  const desc = metaDescription(html);
  const bucket = docs[lang];
  pages++;

  if (title) bucket.push({ k: 'p', t: title, x: (desc || '').slice(0, MAX_TEXT), u: url });
  bucket.push(...extractFaqLd(html, url));
  bucket.push(...extractTopSections(html, url, title));
  bucket.push(...extractPlanCards(html, url));
  bucket.push(...extractSections(html, url, title));
}

// Duplikate (gleicher Titel + gleiche URL) entfernen
for (const lang of ['de', 'en']) {
  const seen = new Set();
  docs[lang] = docs[lang].filter((d) => {
    const key = d.t + '|' + d.u;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

for (const lang of ['de', 'en']) {
  const out = { v: 1, lang, docs: docs[lang] };
  const path = join(ROOT, `search-index.${lang}.json`);
  writeFileSync(path, JSON.stringify(out));
  const kb = Math.round(statSync(path).size / 1024);
  console.log(`✓ ${path} — ${docs[lang].length} Einträge, ${kb} KB`);
}
console.log(`Fertig: ${pages} Seiten indexiert.`);

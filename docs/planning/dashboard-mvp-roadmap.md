# sur.plus Dashboard — Roadmap zum voll funktionsfähigen, state-of-the-art MVP

Stand: 2026-07-09 · Autor: Engineering (Cowork, im Loop mit Flo)
Prinzipien: **Smart Simplicity** · kleine verifizierte Slices (Route+UI+Test) · **Preview-first**
(Demo läuft ohne volle Supabase) · Security **proportional** (Baseline steht schon) · DE/EN.

Arbeitsmodell: Ich baue passgenaue Slices + Syntax-Check; du fährst `typecheck/test/build` auf
dem Mac und pushst. Persistenz-/DB-Schritte sind je Slice als eigener, DB-verifizierter
Unterschritt markiert.

> Dieses Dokument ist der **Backlog** und liegt seit 2026-07-09 versioniert unter
> `docs/planning/` (vorher `05_Landingpage/Baupläne/`, gitignored). Änderungen bitte hier.

---

## Status heute

- **Rückgrat steht (E1–E25):** Supabase-Auth/Session, Invitations-Lifecycle, Ops-Bootstrap,
  Agent-Runs/Actions mit Freigabe, Service-Chat-Realtime, Entitlements, 22-Control-Security-Baseline.
- **Phase A ist auf `main` ausgeliefert:** Match-Confirm-UI, Listing-Formular, Bedarfs-Formular,
  Zertifikat + CSRD-Note aus echten Match-Daten, Logistics-Panel. Der Kundenloop ist klickbar.
- **Phase C teilweise auf `main`:** C1 `transition_match`-RPC (inkl. pgTAP) und C2 Listings/Needs-
  Create-RPCs sind gemerged. Offen: C3 Certificates/Reports, C4 Storage-Signed-URLs.
- **Phase B1 ausgeliefert:** Design-Tokens (Marken-Farben, Schatten, Display-Serif), App-Shell
  (dunkle Topbar + Sidebar), aufgewertete Karten, rollenbewusste Sektions-Navigation.
- **Bekannte Lücke aus dem Shell-Redesign:** die Sidebar ist unter `lg` ausgeblendet — die
  Sektions-Navigation ist derzeit **Desktop-only** (siehe B8).
- **Fonts:** bewusst CDN-frei (Georgia-Fallback für die Display-Serif). Echte Webfonts nur
  self-hosted (woff2 in `/public`) — `next/font/google` ist raus, weil der Build-Zeit-Fetch die CI bricht.

---

## Phase A — Kern-Kundenloop interaktiv machen (Priorität 1)

Ziel: Ein Corporate/NGO kann den kompletten Loop klicken. Domain existiert meist schon —
je Slice nur Route + UI + Test.

**A1 · Match bestätigen/voranbringen** (in Arbeit)
- A1.1 Domain-Command `parseMatchTransitionCommand` ✅
- A1.2 Route `POST /api/matches/:id/transition` (Preview) ✅
- A1.3 **UI:** rollenbewusster Confirm-Button an den Match-Karten (nächster erlaubter Zustand),
  ruft Route mit Idempotency-Key; Optimistic-UI + Fehler-/Quota-Toast. Kontakt-Freigabe wird
  bei `both_confirmed` sichtbar.

**A2 · Surplus listen (Corporate)** — Eintritt des Funnels
- Domain: `repository.listings.create` + Command-Parser (Contract `listings.create` existiert schon).
- Route `POST /api/listings` (Preview) + Test.
- UI: geführtes Formular (Kategorie/Menge/Zustand/Standort/Foto-Slots), Validierung, Eligibility-Checks.

**A3 · Bedarf posten (NGO)**
- Domain `repository.needs.create` + Parser (Contract `needs.create` existiert).
- Route `POST /api/needs` (Preview) + Test.
- UI: Bedarfs-Formular (Kategorie/Menge/Zieldatum/Begünstigte/Story).

**A4 · Nachweis & Impact sichtbar** (read)
- Route/Selector: Spendenbescheinigung + CSRD-Note pro abgeschlossenem Match, Impact-Kennzahlen.
- UI: „Certificate ready", CO₂e/Impact-Cards mit echten Match-Daten (statt reiner Demo-Bilder).

**A5 · Logistics-Tracker** (read + minimaler Status)
- UI: Abhol-/Liefer-Status pro Match (Felder existieren: carrier, trackingRef, pickup/delivery).
- Admin/Ops kann `in_transit`/`delivered` setzen (nutzt A1-Route, andere Ziel-Zustände).

**Ergebnis Phase A:** Der Loop *List → Match → Confirm → Deliver → Certificate* ist im Preview
end-to-end klickbar.

---

## Phase B — UX/UI auf 10/10 (parallel zu A, nicht demohaft)

**B1 · Design-System-Grundlage**
- Tailwind-Tokens/Theme konsolidieren (Farben `surplus-moss/clay` etc.), Typo-Skala, Spacing,
  Komponenten-Primitiven (Card, Button, Badge, Field, Toast, EmptyState, Skeleton). Ein Ort.
- **B1.2 ✅ Shell geteilt.** Topbar, Sidebar und mobile Chip-Navigation lagen nur in
  `demo/page.tsx` — die **eingeloggte App unter `/` hatte gar keinen Shell** und sah damit
  schlechter aus als ihre eigene Demo. Extrahiert nach
  `app/components/shell/WorkspaceShell.tsx`; beide Oberflächen teilen sich jetzt eine
  Chrome. Oberflächen-Spezifisches (Identität, Topbar-Slot, Sidebar-Fuß) kommt per Prop,
  der Shell bleibt Server-Komponente ohne Client-JS.
  Im echten Workspace stammt die Sidebar-Identität aus **echten Daten** (Firmen-/NGO-Name,
  Plan), der Tier-Text aus dem Wörterbuch.
- Offen: Button-, Badge- und Field-Primitiven (bisher nur Card, EmptyState, Metric).

**B2 ✅ · Login/Register „ruhig, hochwertig, 10/10"**
- `AuthShell` + `AuthCard` in `components/shell/`: dieselbe Topbar und Typografie wie der
  Workspace, aber **bewusst ohne Sidebar** — vor dem Login gibt es weder Identität noch
  Sektionen zu navigieren.
- `login/page.tsx` neu: Karte mit `shadow-cardlg`, Serif-H1, DE/EN-Umschalter.
  Der **Einladungs-Token überlebt den Sprachwechsel** (`loginHref`) — sonst verliert ein
  eingeladener Kunde beim Klick auf „DE" seine Einladung.
- `WorkspaceRoleRequired` und `WorkspaceProvisioningPending` nutzen denselben Rahmen.
- **Kein Pricing vor Rollen-/Workspace-Kontext** — bleibt eingehalten.
- Offen: `AuthSessionControls` und `InvitationAcceptancePanel` sind Client-Komponenten mit
  eigenen englischen Labels (E-Mail-Feld, Buttons). Sie gehören zu **B7.2**.

**B3 ✅ · Zustände überall:** Loading (Skeletons), Empty (mit klarer nächster Aktion), Error.
- `EmptyState`-Primitive in `shared.tsx`: Titel, Erklärung, optional **nächster Schritt**.
  Gestrichelter Rahmen — unterscheidet „noch nichts da" von „Karte konnte nicht laden".
  Acht tote Absätze („No matches visible to Ops yet.") ersetzt.
- `app/demo/loading.tsx`: Skelett in der Silhouette des Shells (Topbar, Sidebar-Spalte,
  Header, KPI-Reihe), damit beim Streamen nichts springt. `aria-busy` + `sr-only`-Hinweis.
- `app/error.tsx` bestand bereits.
- Offen: Success-/Toast-Zustände nach Mutationen; die Empty-State-Texte sind noch
  englisch (kommen mit B7.2 ins Wörterbuch).

**B4 · Demo-Dashboard mit ECHTEN Beispielinhalten:** Spendenbescheinigung, Logistics-Tracker,
Impact-Cards mit Bildern, Seed/Tree-Profil, klarer **Seed→Tree-Upgrade-Hinweis** (hochwertig, ruhig).

**B5 · Tree-Vorschau im Demo-Dashboard (deine Idee)**
- Plan-Umschalter „Ansicht: Seed ⇄ Tree" (bzw. `?plan=tree`) im Preview, damit **KD beide Stufen
  einsehen**. Tree-only-Bereiche klar mit „Tree"-Badge: audit-grade CSRD (ISAE 3000),
  Green-Procurement-Zertifikat, Social-Media-Impact-Cards, Employer-Branding-Dashboard,
  unbegrenzte Matches, 5 Seats, Priority-Curation.
- Doppelnutzen: Demo **und** inline Upsell. Rein Anzeige — keine echten Tree-Rechte für Seed.

**B6 · Corporate vs. NGO Feinschliff:** leicht unterschiedliche Akzente/Farbe, nicht verspielt.

**B7 · i18n DE/EN** (key-basiert, löst die alte Phrasen-Map ab) + `de`/`en`-Routing.
- **B7.1 ✅** Fundament: `apps/web/app/lib/i18n.ts` mit typisierten Wörterbüchern.
  `Dictionary` wird aus dem EN-Eintrag abgeleitet — fehlt ein DE-Key, bricht der
  **Typecheck**, nicht die Seite. Kein Runtime-Fallback, bewusst.
  Angewandt auf die Shell-Chrome der Demo (Topbar, Sidebar, mobile Chips, Seitenkopf),
  Sprachumschalter `EN | DE` in der Topbar (`?lang=de`), `lang`-Attribut am Shell.
  Invariante gewahrt: **nur Chrome wird übersetzt**, Demo-/UGC-Inhalte nie.
- **B7.2** Offen: Panels und Dashboards (Corporate/NGO/Ops, `shared.tsx`, Formulare,
  `NgoDownloadsPanel`). Das sind einige hundert Strings — eigener Slice.
- **B7.3** Offen: echtes `/de`-`/en`-Routing (`app/[locale]/…`). Aktuell entscheidet der
  Query-Parameter `?lang=`. Beim Umbau an `proxy.ts` (CSP) und die Sitemap denken.

**B8 ✅ · Responsiveness & A11y:** Mobile-Sektions-Navigation als sticky Chip-Leiste
(server-gerendert), Kurz-Labels für die Rollen-Tabs, sichtbare Fokus-Ringe, ARIA-Labels
aus dem Wörterbuch. Offen: Kontrast-Audit und vollständige Tastaturnavigation.

---

## Phase C — Persistenz produktiv (Supabase), je Write ein DB-Slice

Für jeden Write aus Phase A: Postgres-RPC + Migration + `*WithSupabaseRpc`-Wrapper, **RLS-Policies**
(Trust-Boundary, Org-Scope), Integrationstests (pgTAP/RLS). Ersetzt die 503-Preview-Platzhalter.
- C1 Match-Transition-RPC (`transition_match`) inkl. Quota/Audit in SQL.
- C2 Listings/Needs-Create-RPCs. C3 Certificates/Reports. C4 Storage-Signed-URLs.

---

## Phase D — Dokumente, Uploads, Zertifikate, E-Signatur

> **Befund 2026-07-10:** Das `EvidencePanel` hatte einen **„Upload file"-Knopf ohne Handler** —
> klickbar, wirkungslos, ausgerechnet in der Karte, die „audit-grade evidence" behauptet.
> Entfernt und durch einen ehrlichen Hinweis ersetzt (Dateien vorerst über den Service-Thread).
> Ebenfalls entfernt: Demo-Sprache, die ins Produkt geleckt war — „Complete demo file set" und
> „Operational workspace with real example content" standen auch im echten, eingeloggten
> Workspace, weil `EvidencePanel` und `WorkspaceProfile` von `/` und `/demo` geteilt werden.
> Der Knopf wird erst wieder eingebaut, wenn C4 (Storage + Signed URLs) steht.

- Supabase Storage + `documents`-Flow (Contract `documents.create` existiert): Upload für Impact-Cards,
  Logistics-Evidence, Kapazitätsnachweise (signed URLs).
- **C3 ist im Wesentlichen erledigt** (Korrektur einer früheren Annahme): Migration `0004`
  erzeugt Zertifikat und CSRD-Note per `ensure_completion_documents()` beim Match-Abschluss,
  abgesichert durch `supabase/tests/completion_documents.test.sql`. Was fehlt, ist C4.
- Spendenbescheinigung als Dokument; DocuSeal-Envelope für Partner-Agreements/Zertifikate
  (Contract + Schema liegen vor) — Webhook-Sync, kein Client-Krypto.

**D6 · NGO-Starter-Paket — Download-Bereich im NGO-Dashboard** (neu, 2026-07-09)

Ziel: NGOs, die gespendete Ausstattung erhalten, sofort arbeitsfähig machen — ohne dass sur.plus
zum Software-Hoster oder zur Steuerberatung wird.

Inhalt (empfohlen):
- **Kuratierte Open-Source-Software** (LibreOffice, Thunderbird, Firefox, GIMP, 7-Zip):
  nur **offizielle Links**, *keine gehosteten Binärdateien* — Weitergabe-, Update- und
  Integritätsrisiko liegt sonst bei uns. Auch **keine eigenen Prüfsummen**: eine veraltete
  ist schlimmer als keine; wir verweisen auf die der Hersteller.
- **ODF-Vorlagen** (`.odt`/`.ods`) für genau das, was die App **nicht** generiert:
  Übergabeprotokoll, Inventarliste der erhaltenen Sachspenden, Impact-Story-Vorlage
  (fließt ins Reporting zurück).
- **Kurz-Guide**: Ersteinrichtung gespendeter Geräte, Datenlöschung (löscht der Corporate,
  prüft die NGO), Nutzung der Vorlagen.

Explizit **nicht**: Software-Binaries hosten · Spendenbescheinigung als Vorlage (die erzeugt die
App bereits aus Match-Daten — keine zweite Quelle) · Steuer-/Rechtsberatung. Vorlagen tragen
einen „unverbindlich, mit Steuerberatung prüfen"-Hinweis.

Slices:
- **D6.1 ✅** Statisches Paket unter `apps/web/public/ngo-starter/`, erzeugt von
  `tools/build_ngo_starter.py` (reproduzierbar, keine undurchsichtigen Binärdateien):
  Übergabeprotokoll, Inventarliste, Impact-Story, Geräte-Ersteinrichtung + ZIP-Bundle.
  Katalog typisiert in `apps/web/app/lib/ngo-starter.ts` statt `manifest.json` —
  typsicher, kein Runtime-Fetch. **Ohne Prüfsummen**: eine veraltete Prüfsumme ist
  schlimmer als keine; die Hersteller veröffentlichen aktuelle neben dem Download.
- **D6.2 ✅** `NgoDownloadsPanel` im NGO-Dashboard, Sektion `id="n-downloads"`,
  Nav-Eintrag „Starter package" (Sidebar + mobile Chips teilen `SECTION_NAV`),
  ZIP-Gesamtdownload. Server-Komponente, kein Client-JS.
- **D6.3 ✅ — entschieden: kein Rollen-Gate, das Paket bleibt offen zugänglich.**
  Ursprünglich war eine serverseitige NGO-Rollenprüfung geplant. Zwei Gründe dagegen,
  beide bestätigt (Founder, 2026-07-10):
  1. *Sicherheit:* Der Inhalt sind leere Vorlagen und Links auf öffentliche Downloads —
     es gibt nichts zu schützen. Ein Gate wäre eine Route plus Tests für null
     Sicherheitsgewinn und widerspräche „Security proportional".
  2. *Akquise:* Das offene Paket **zeigt interessierten NGOs vorab, was sie bei sur.plus
     bekommen.** Es ist damit Nutzen und Beleg zugleich, kein Leck.

  Konsequenz: Das Starter-Paket ist ein öffentliches Asset. Es darf nie NGO- oder
  Match-spezifische Daten enthalten. Sobald etwas Personenbezogenes oder
  Workspace-Spezifisches hinein soll, gehört es **nicht** hierher, sondern in den
  `documents`-Flow (D6.4 / C4, signierte URLs).
- **D6.4** (später) Audit-Event pro Download + Umzug auf Supabase-Storage-Signed-URLs — zieht C4.

Abhängigkeiten: nur D6.4 braucht C4.

Entschieden (2026-07-10):
- **Zweisprachig.** Jede Vorlage liegt in DE und EN vor, dazu ein ZIP je Sprache.
  Das Panel bietet pro Vorlage einen DE- und einen EN-Download.
- **Keine Partnernennung** im Geräte-Guide (kein Labdoo, kein AfB). Der Guide verweist
  nur auf die im Arbeitsbereich verlinkten Programme.
- **Offen zugänglich** (siehe D6.3) — bewusst als Schaufenster für interessierte NGOs.

**D6.1–D6.3 sind abgeschlossen.** Offen bleibt nur D6.4 (Audit-Event + Signed URLs),
und das erst, wenn Inhalte workspace-spezifisch werden.

Technische Notiz: die DE-Dateien liegen flach unter `public/ngo-starter/`, die EN-Dateien
in `public/ngo-starter/en/`. Die Asymmetrie entstand, weil der Agent keine Dateien löschen
kann (Umbenennen setzt Löschen des alten Pfads voraus). Ursache ist **nicht** iCloud,
sondern der Cowork-Mount — das gilt auch nach dem Repo-Umzug weiter. Wer direkt am Repo
arbeitet, kann auf `de/` + `en/` normalisieren; danach `tools/build_ngo_starter.py` und
`apps/web/app/lib/ngo-starter.ts` anpassen.

---

## Phase E — Kommunikation

- Service-Chat (Realtime existiert) feinpolieren: NGO/Corporate ↔ sur.plus/Florian, Zustände,
  Benachrichtigungen; Chat-Bereich sauber ins Dashboard.

---

## Phase F — Ops/Admin (NACH dem Kundenloop)

- E25 **Ops Risk/Audit Queue**: Domain-Projektion ✅ (ruht) → Read-API + Ops-Cockpit-UI.
- NGO-Verifizierungs-Aktionen (approve/request-info) als echte Routen+UI.

---

## Phase G — Production-Readiness

- **Branch Protection** auf `main` (Status-Checks erzwingen; GitHub flaggt es) — proportional.
- **Ordner-Konsolidierung** (bereits entschieden): Landing → `apps/landing`, Baupläne → `docs/planning`,
  Prototyp retiren — eigener, von dir verifizierter PR.
- Monitoring/Error-Tracking (leichtgewichtig), Plausible-Analytics, Launch-QA (Netlify/Deploy),
  Impressum/Datenschutz final.

---

## Querschnitt (immer)

- **Tests**: je Slice Unit (Domain) + Route + später e2e (Playwright) für den Loop.
- **Security proportional**: Baseline steht — nichts Schweres draufpacken; nur pro Write die
  RLS-Policy + Input-Validation sicherstellen.
- **Loop-Disziplin**: kleine PRs, `typecheck+test+build` grün, dann commit/push.

---

## Empfohlene nächste 3 Slices (konkret · Stand 2026-07-09)

Phase A und C1/C2 sind erledigt, B1 ist ausgeliefert. Die nächsten Slices ergeben sich daraus:

1. **B8 · Mobile-Navigation für den App-Shell** — die Sidebar ist unter `lg` ausgeblendet, damit
   ist die Sektions-Navigation Desktop-only. Dazu Fokus-States/ARIA-Durchgang. *(Regression aus
   dem Redesign — zuerst schließen.)*
2. **D6.1–D6.3 · NGO-Starter-Paket** (Download-Bereich) — ohne DB lieferbar, klarer NGO-Nutzen,
   passt direkt in die neue Sektions-Navigation.
3. **B3 · Zustände überall** — Loading-Skeletons, Empty-States mit nächster Aktion, Error/Success
   im neuen Karten-System. Keine toten Panels.

Danach naheliegend: **C3** (Certificates/Reports-RPC) und **B7** (i18n DE/EN).

---

## Nachträge 2026-07-12 (im Loop mit Flo)

**Slice · Spendenbescheinigung-Gegenzeichnung + A1 (als EIN Slice — entschieden 2026-07-12)**
Flow: sur.plus erzeugt aus den *vereinbarten* Überschussdaten das Bescheinigungs-Muster → NGO
bekommt es „zur Gegenzeichnung/Bestätigung" auf der Plattform → nach NGO-Bestätigung Freigabe an
die Corp-Seite.
- Lebenszyklus: `documents.status` erzeugt als `in_review` (statt heute `approved` in 0004) →
  **NGO-only Confirm-RPC** → `published`; Corp-Download erst bei `published`, davor sichtbar als
  „ausstehend: Bestätigung durch NGO".
- A1 im selben Slice: NGO-Echtheitsdaten (Freistellungsbescheid/Registernummer, Finanzamt,
  zeichnungsberechtigte Person) erfassen und aufs Muster stempeln (rechtliche Vollständigkeit).
- „Gegenzeichnung" = On-Platform-Bestätigung + Audit-Event, **kein DocuSign** (§50 EStDV:
  maschinell ohne Unterschrift). Formfragen → Notion-Rechtsfragen-Tracker (SBS Legal / Kleeberg).
- Ändert `ensure_completion_documents` (0004) + `supabase/tests/completion_documents.test.sql`.

**Slice · Copilot-Überschuss-Intake (Idee 2026-07-12)**
Corporate lädt eine Überschussliste hoch (CSV/XLSX zuerst; PDF/Scan später) → AI-Copilot parst
Positionen (Name, Menge, Kategorie, Zustand, Schätzwert) → erzeugt `AgentProposedAction`s →
Corporate prüft/genehmigt → Listings via bestehende Create-RPC. Reuse: Upload-Komponente,
Agent-Proposed-Action + Freigabe (AI schlägt vor, Mensch bestätigt — kein Auto-Erstellen),
Listing-Create-RPC. Kritisch: LLM-Genauigkeit (Freigabe-Gate fängt's ab), Formate klein anfangen
(CSV/XLSX), Datenschutz (Listen-Inhalt → EU-LLM-Verarbeitung, Prozessor dokumentieren).

**Update 2026-07-12 — a1 (Execute-Dispatcher) gebaut:**
`perform_agent_action` (Migration `0009`) legt bei einer *approved* Listing-Aktion mit `target_id IS NULL`
jetzt eine echte Listing via `create_listing` an — In-Memory-Parität in `applyExecutedAction`. Neuer
`surplus_intake`-Plan im deterministischen Planner; der Copilot-Upload erzeugt einen Agent-Run statt
direkt zu erstellen — die Vorschläge erscheinen im LoopPanel zur Freigabe (approve → execute → Listing),
gecappt auf 40 Zeilen (Prompt-Limit 4000). **Offen:** a2 LLM-Parsing (EU-Provider-Entscheidung),
XLSX/PDF, pgTAP für den neuen Execute-Zweig.

**Ops / Infra (2026-07-13):**
- **TLS-Zertifikat `surpluspurpose.com` läuft 26.07. aus** (Netlify-Mail). Wildcard-Renewal scheitert
  an der DNS-01-Challenge (NXDOMAIN `_acme-challenge`). `send.` = Resend (kein Netlify-Cert).

  **Diagnose 2026-07-13 (per Netlify-Dashboard + DNS-Checks aufgeklärt):**
  - **Kein Ausfallrisiko zum 26.07.** Die tatsächliche DNS-Delegation von `surpluspurpose.com` liegt bei
    **Cloudflare** (`brett/rose.ns.cloudflare.com`), NICHT bei Netlify DNS. Apex + `www` laufen über den
    **Cloudflare-Proxy** (IPs 188.114.96/97.12) → öffentlich sichtbares Zertifikat = **Cloudflare Universal
    SSL** (auto-renewed). Das ablaufende Netlify-Wildcard liegt nicht im öffentlichen TLS-Pfad.
  - `app.surpluspurpose.com` ist **DNS-only direkt auf Netlify** (`surplus-app.netlify.app`) und hat ein
    **eigenes gültiges Standard-Cert** (Let's Encrypt, HTTP-01, Auto-Renew **Okt 3**). ✓
  - Das ablaufende Cert ist ein **veraltetes, ungenutztes** Wildcard der Tippfehler-/Alt-Konfiguration
    (`*.surplusepurpose.com`); Renewal scheitert, weil Netlifys DNS-Zone (`dns1–4.p09.nsone.net`) NICHT
    autoritativ ist (Cloudflare ist es) → `_acme-challenge` public NXDOMAIN. Renewal wurde am 13.07.
    angestoßen (schlägt erwartungsgemäß weiter fehl, solange Netlify die Wildcard-DNS-01 versucht).
  - **Cleanup (Flo, optional, kein Zeitdruck):** entweder (a) stale Netlify-DNS-Zone `surpluspurpose.com`
    entfernen, damit Netlify das Cert nicht mehr renewt (Zone ist ungenutzt, Cloudflare ist autoritativ),
    oder (b) in Netlify per „Set custom certificate" ein Cloudflare-Origin-Cert hinterlegen, oder (c)
    ignorieren (kosmetisch). Zusätzlich in Cloudflare **SSL/TLS-Modus ≥ „Full"** sicherstellen (nicht
    „Full strict", solange Origin-Cert nicht garantiert) für den Cloudflare→Netlify-Origin-Hop.

**Update 2026-07-13 — CI-Stabilität + Slices:**
- Font-CI-Bruch behoben (`layout.tsx` ohne `next/font/google`-Build-Fetch; Georgia/System-Fallback).
  Custom-Fonts nur zurückholen mit echten woff2 in `/public` via `next/font/local`.
- Alle `"latest"`-Deps auf exakte Versionen **gepinnt** (stabiles Lockfile, kein Churn mehr).
- **XLSX-Upload** (SheetJS) + **Muster-Template** `public/surplus-template.xlsx` + „Download template".
- **Clickwrap** (`AgreementClickwrap` + RPC `accept_agreement`/0010): Corp=ToS, NGO=Partner-Agreement.
- pgTAP ergänzt: `agreement_acceptance`, `match_evidence`, `agent_execute_create_listing`.
- **Offen:** echte AGB/Partner-Agreement-Inhalte+URL (Corp-Clickwrap zeigt vorerst auf die LP);
  §50-EStDV-Bestätigung; Datenschutz-Restpunkte (AVV/SCCs/Art.30/Double-Opt-in); unified Login;
  B7 i18n; Phase F/G.

**Update 2026-07-13 — Server-2FA, Clickwrap-Gating, Entscheidungen:**
- **Server-seitige 2FA-Durchsetzung** (AAL2-Gate): OAuth/Magic-Link können 2FA nicht mehr umgehen.
- **Clickwrap-Enforcement gebaut** (Migration `0012` + `has_accepted_current_agreement` +
  `agreement_requirements`): Corporate-Match-Bestätigung erfordert akzeptierte SaaS-Terms,
  NGO-Gegenzeichnung erfordert Partner-Agreement (`agreement_required`); Client-Gating via
  `useAgreementAccepted`; Versionen zentral in `lib/agreements.ts`. pgTAP `clickwrap_gating` ergänzt.
- **Migrationen 0007–0012 auf surplus-staging angewendet** (SQL-Editor).
- **a2 LLM-Parsing (Mistral) → bewusst BACKLOG (Entscheidung 2026-07-13).** Begründung: deterministischer
  Parser deckt CSV/XLSX für Launch ab; LLM-Mehrwert nur bei Freitext/PDF (kein belegter Engpass);
  Kunden mit eigener KII (Claude etc.) liefern eh saubere Listen → besser gute Vorlage + verlässlicher
  Import als eigener NLP-Layer; Kosten wären vernachlässigbar (Cent-Bruchteile/Liste, Mistral Small
  $0.10/$0.30 pro 1M), aber zusätzliche Vendor-/AVV-/Komplexitäts-Fläche vor Produktvalidierung nicht
  gerechtfertigt. **Revisit** bei PDF/Scan-Intake oder echter User-Friction.
- **Neues NGO-Perk:** kostenlose KI-Starthilfe für Partner-NGOs (Framing siehe CLAUDE.md) — Einbau in
  NGO-Dashboard, LP-NGO-Sektion, NGO-Outbound.

# Anforderungskatalog — sur.plus

> **Zweck.** Gemeinsame, verbindliche Referenz „*was soll die App können*". Ergänzt die
> ADRs (Entscheidungen: *warum* haben wir etwas so gebaut) und die Roadmaps (Richtung)
> um die dritte Ebene: **Anforderungen** (*was* wird gebaut, prüfbar, mit Status).
>
> **Status: Format beschlossen (2026-07-20).** Das Katalog-Format ist in der Abstimmung mit
> Florian festgelegt (siehe „Wie dieser Katalog funktioniert"). Die Anforderungen werden
> Bereich für Bereich ausformuliert; begonnen mit den am 2026-07-20 entschiedenen Bereichen.
> Nichts hier ist ein Bau-Ticket, bis eine Anforderung auf `Must`/`🔴 offen` gesetzt und
> einem PR zugeordnet ist.

Stand: 2026-07-21 · Autor: Cowork (Andi) · Status: **Ausformulierung läuft** — fertig:
AUTH, NGO, MATCH, DOC, OPS, PLAN, LEGAL, NOTIFY, NFR·Sicherheit&Datenschutz · offen:
CORP, AGENT, NFR·(Performance/i18n/Betrieb/Rollback)

---

## Wie dieser Katalog funktioniert

### ID-Schema

Jede Anforderung hat eine stabile ID `REQ-<BEREICH>-<NR>` (z. B. `REQ-MATCH-03`).
Die ID ändert sich nie — sie wird in Commits, PRs und ADRs referenziert
(`feat: … (REQ-MATCH-03)` / `Closes REQ-MATCH-03`). Neue Anforderungen bekommen die
nächste freie Nummer im Bereich; gelöschte Nummern werden **nicht** wiederverwendet.

### Bereiche

| Kürzel | Bereich | Umfang |
|---|---|---|
| `AUTH`  | Zugang & Identität | Signup, Login (Magic-Link), Einladungen annehmen, Onboarding, „Zugang anfragen" |
| `CORP`  | Corporate-Workspace | Listings, Bedarfs-Katalog browsen, Dashboard „Was jetzt?" |
| `NGO`   | NGO-Workspace | Verifizierung, Bedarfe posten, Empfang bestätigen |
| `MATCH` | Match-Lebenszyklus | Die eine Statemachine: proposed → … → completed, Kontakt-Gate, Chat |
| `DOC`   | Dokumente & Compliance | Spendenbescheinigung, CSRD-Note, ESRS-Export, E-Signatur (DocuSeal) |
| `OPS`   | Admin / Ops | Bootstrap, Ops-Queue, Risk-Queue, Matching, Plan setzen, Audit |
| `AGENT` | KI-Agent | Findings & Vorschläge erzeugen, menschliche Freigabe, Ausführung |
| `PLAN`  | Pläne & Entitlements | registered / seed / tree, Quota, Sitze, Feature-Gating |
| `LEGAL` | Recht & Haftung | AGB/Clickwrap, Ausstellerhaftung Spendenwert, Beleg-/Nachweis-Pflicht, Steuerberater-Freigabe |
| `NOTIFY`| Benachrichtigungen | Auth-Mails, Match-Erinnerungen, Verfall-Vorwarnung, Statuswechsel-Mails |
| `NFR`   | Nicht-funktionale Anf. | Sicherheit, Datenschutz, Performance, i18n, Betrieb/Deploy |

### Legende

**Status** — was ist heute Realität?

| Symbol | Bedeutung |
|---|---|
| ✅ | gebaut & verifiziert (Route + Logik + Test vorhanden) |
| 🟡 | teilweise (z. B. Logik da, UI fehlt / nur in Demo / nur auf Staging bewiesen) |
| 🔴 | offen (deklariert, aber nicht gebaut) |
| 💡 | Idee / Backlog (noch nicht beschlossen) |

**Priorität** (MoSCoW) — `Must` · `Should` · `Could` · `Won't (yet)`

**Rolle** — `Corporate` · `NGO` · `Admin` · `System` (oder mehrere)

---

## Template — so sieht eine Anforderung aus

> Kopiervorlage. Eine filled-in Beispiel-Anforderung darunter zeigt das Format konkret.

```markdown
### REQ-<BEREICH>-<NR> — <Kurztitel>

- **Rolle:** <Corporate | NGO | Admin | System>
- **Beschreibung:** Als <Rolle> möchte ich <Ziel>, damit <Nutzen>.
- **Akzeptanzkriterien:**
  - [ ] <prüfbares Kriterium 1>
  - [ ] <prüfbares Kriterium 2>
- **Status:** <✅ | 🟡 | 🔴 | 💡>
- **Priorität:** <Must | Should | Could | Won't>
- **Bezug:** <ADR-00xx / Migration 00xx / Route / — >
- **Notizen:** <offene Founder-Calls, Abhängigkeiten>
```

#### Beispiel (Format-Illustration, noch nicht Teil des Katalogs)

> ### REQ-MATCH-02 — Match beidseitig bestätigen (Kontakt & Quota)
>
> - **Rolle:** Corporate, NGO
> - **Beschreibung:** Als Corporate möchte ich einen vorgeschlagenen Match bestätigen,
>   nachdem die NGO bestätigt hat, damit die Zusammenarbeit verbindlich startet.
> - **Akzeptanzkriterien:**
>   - [ ] Übergang `ngo_confirmed → both_confirmed` nur durch das Corporate
>   - [ ] Ab `both_confirmed` sind die echten NGO-Kontaktdaten sichtbar (vorher anonymisiert)
>   - [ ] Genau 1 Match wird von der Jahres-Quota verbraucht; Storno erstattet nicht
>   - [ ] Audit-Event `match.transition` wird geschrieben
> - **Status:** 🟡 (DB-Logik auf Staging bewiesen, eingeloggte UI live nicht erreichbar)
> - **Priorität:** Must
> - **Bezug:** ADR-0026 · Migration 0002 · `POST /api/matches/:matchId/transition`
> - **Notizen:** hängt an AUTH-live (Prod ohne Supabase-Env = Gate)

---

## AUTH — Zugang & Identität

*Umfang: Signup, Magic-Link-Login, Einladungen annehmen, Onboarding-Leerzustand,
„Zugang anfragen" (Lead-Capture). Offene Founder-Calls: invite-only bleiben? Demo als
eigener Einstieg statt in der Login-Maske.*

*Bereich beschlossen am 2026-07-20 (Abstimmung C1–C5, E4/F1/F3) → ADR 0027. Feingranular (B1).*

### REQ-AUTH-01 — Registrierung ist ein Antrag, kein Zugang

- **Rolle:** Corporate, NGO, System
- **Beschreibung:** Als neuer Nutzer möchte ich mich mit meiner Rolle (Corporate/NGO)
  anmelden und einen Workspace beantragen, aber erst nach **bestandener Verifizierung**
  wirklich handeln dürfen, damit ungeprüfte Konten keinen Schaden anrichten.
- **Akzeptanzkriterien:**
  - [x] Rolle wird bei der Anmeldung gewählt; `requested_role` landet in den Signup-Metadaten
  - [x] Nach E-Mail-Bestätigung provisioniert `claim_workspace` den Workspace (Corporate → `companies`/Plan `registered`, NGO → `ngos`/`verification_state='onboarding'`)
  - [x] Admin wird **nie** self-service provisioniert
  - [x] Matching, NGO-Kontakt und Dokumente erst nach Verifizierung frei — unabhängig vom Plan (Migration 0038: `propose_match`/`transition_match`, Kontakt-RLS, Dokument-RLS)
  - [x] Listing anlegen erst nach Verifizierung (ADR 0027; Migration 0063 / `company_not_verified`)
- **Status:** 🟢 (Self-Provisioning + Gating für Matching/Kontakt/Dokumente/Listing; live-Verify in M9)
- **Priorität:** Must
- **Bezug:** ADR 0027 (C2) · Migration 0019 (`claim_workspace`) · Migration 0038 (Verifizierungs-Gating) · `ClaimWorkspacePanel.tsx`

### REQ-AUTH-02 — Passwortloser Login per Magic-Link

- **Rolle:** Corporate, NGO, Admin
- **Beschreibung:** Als Nutzer möchte ich mich ohne Passwort über einen per E-Mail
  zugeschickten Anmelde-Link einloggen, damit der Zugang einfach und ohne Passwort-Risiko ist.
- **Akzeptanzkriterien:**
  - [x] `signInWithOtp` fordert einen Magic-Link an (kein `shouldCreateUser:false` → kein Invite-only-Silent-Bug)
  - [ ] Mailversand ist produktiv zuverlässig (aktuell: kein Custom-SMTP → eingebauter Notversand stark rate-limited)
  - [ ] Login lokal echt testbar (lokaler Supabase-Stack + `.env.local` + Mail-Fänger)
- **Status:** 🟡 (Client-Logik korrekt; Prod-Mailversand + lokale Testbarkeit offen)
- **Priorität:** Must
- **Bezug:** `SmartLoginPanel.tsx:252` (`signInWithOtp`) · `login/page.tsx`

### REQ-AUTH-03 — Corporate: Freemail ablehnen, Firmen-Domain verlangen

- **Rolle:** Corporate, System
- **Beschreibung:** Als System möchte ich bei der Corporate-Anmeldung kostenlose
  Freemail-Adressen (gmail/gmx/web.de …) ablehnen und eine Firmen-Domain verlangen, damit
  billig gefälschte Firmen-Konten früh herausgefiltert werden.
- **Akzeptanzkriterien:**
  - [ ] Bekannte Freemail-Domains werden bei Corporate-Signup abgelehnt
  - [ ] NGO bleibt Freemail **erlaubt** (dafür Dokument-Pflicht, siehe REQ-NGO-02)
  - [ ] Ablehnung mit verständlicher Meldung, nicht stiller Fehler
- **Status:** 🔴 offen (keine Validierung im Signup-Flow vorhanden)
- **Priorität:** Must
- **Bezug:** ADR 0027 (C4)

### REQ-AUTH-04 — Zugang nur mit Einladung (Invite annehmen)

- **Rolle:** Corporate, NGO, Admin
- **Beschreibung:** Als eingeladener Nutzer möchte ich eine Einladung über einen Token
  annehmen und dem einladenden Workspace beitreten, damit der Zugang bis zum Launch
  kuratiert und sitzplatz-begrenzt bleibt.
- **Akzeptanzkriterien:**
  - [x] `POST /api/invitations/accept` nimmt eine Einladung an; `/login?invite_token=` wird durchgereicht
  - [x] Sitzplatz-Limit wird geprüft (`seat_limit_exceeded`)
  - [ ] Ende-zu-Ende live getestet (hängt an AUTH-live)
- **Status:** 🟡 (Route + RPC gebaut; Live-Test offen)
- **Priorität:** Should
- **Bezug:** ADR 0027 (E4) · `POST /api/invitations/accept` · `InvitationAcceptancePanel.tsx`

### REQ-AUTH-05 — „Zugang anfragen" (Lead-Capture)

- **Rolle:** System
- **Beschreibung:** Als Interessent ohne Einladung möchte ich meinen Zugang anfragen
  können, damit wir schon vor dem Launch Interessenten sammeln und nachfassen.
- **Akzeptanzkriterien:**
  - [x] Ein Formular (`/request-access`) erfasst Lead-Daten (Name, Organisation, Rolle, Kontakt) inkl. Datenschutz-Einwilligung
  - [x] Anfragen landen in einer für Ops sichtbaren Liste (Ops-Cockpit, Tabelle `access_requests`, nur Admin lesbar)
  - [x] Der Calendly-Link bleibt als zweiter Weg auf der Login-Seite
- **Status:** 🟢 (gebaut; live-verifiziert offen)
- **Priorität:** Should
- **Bezug:** ADR 0027 (E4/F3) · `login/page.tsx:89`

### REQ-AUTH-06 — Demo als eigener, abgeschotteter Einstieg

- **Rolle:** System
- **Beschreibung:** Als Interessent möchte ich die App gefahrlos ausprobieren, ohne fremde
  Eingaben zu sehen oder echte Daten zu berühren, damit ich mir einen echten Eindruck
  verschaffen kann.
- **Akzeptanzkriterien:**
  - [x] Ohne konfiguriertes Supabase leitet `/login` auf `/demo` (reiner Demo-Modus)
  - [x] Demo ist ein **eigener** Einstieg (`/demo/start`) statt in der Login-Maske versteckt (F2/E4)
  - [x] Je Besucher eine abgeschottete Spielwiese (Cookie `sp_demo`, eigener Seed-Stand im Server-Speicher, nach 2 h Inaktivität automatisch gelöscht) — F2
- **Status:** 🟢 (gebaut; Sandboxes liegen im Speicher einer Instanz — bei mehreren Instanzen braucht ein Besucher Sticky Sessions)
- **Priorität:** Could
- **Bezug:** ADR 0027 (E4/F2) · `login/page.tsx:29` · `demo/page.tsx`

### REQ-AUTH-07 — Passwort-Richtlinie

- **Rolle:** Corporate, NGO, Admin, System
- **Beschreibung:** Als Plattform möchte ich verbindliche Mindestvorgaben für Passwörter
  durchsetzen, damit schwache Passwörter gar nicht erst angelegt werden.
- **Festgelegte Vorgaben (Entscheidung Andi, 2026-07-21):**
  - **Mindestlänge: 8 Zeichen**
  - **Zeichen-Pflicht: Groß- UND Kleinbuchstaben UND Zahl UND Sonderzeichen**
    (Supabase: `password_requirements = "lower_upper_letters_digits_symbols"`)
  - **Leak-Check aktiv:** bekannte geleakte Passwörter werden abgelehnt (Supabase „Prevent leaked passwords")
  - **Keine** erzwungenen regelmäßigen Passwort-Wechsel (nur bei Verdacht auf Kompromittierung)
- **Akzeptanzkriterien:**
  - [ ] Mindestlänge 8 an **allen** Stellen (DB heute 6 → 8; UI-Reset schon 8)
  - [ ] Komplexitätsregel Groß+Klein+Zahl+Symbol server-seitig erzwungen
  - [ ] Leak-Check im Supabase-Dashboard aktiviert
  - [ ] **Vorgaben werden im Formular sichtbar erklärt** — im Registrierungs- **und** im Passwort-setzen-Formular ein Hinweistext direkt am Passwortfeld (welche Regeln gelten)
  - [ ] **Live-Rückmeldung beim Tippen:** eine kleine Checkliste, deren Punkte grün werden, sobald erfüllt (hilft, statt nur zu blockieren)
  - [ ] Klient-seitige Prüfung mit **verständlicher** Fehlermeldung vor dem Absenden (nicht erst nach Server-Ablehnung)
  - [ ] Umsetzung an allen drei Orten konsistent: `config.toml` (lokal), Supabase-Dashboard (Prod), `SmartLoginPanel.tsx` (Signup + Passwort-setzen)
- **Status:** 🔴 offen (heute: DB-Minimum 6, keine Komplexitätsregel, kein Leak-Check; UI verlangt nur beim Reset 8)
- **Priorität:** Must
- **Bezug:** `supabase/config.toml` (`minimum_password_length`, `password_requirements`) · `SmartLoginPanel.tsx:286` (`updatePassword`) · ADR 0006 (Launch-Härtung) · siehe REQ-NFR-10
- **Notiz:** Fachlicher Stand (NIST SP 800-63B, OWASP ASVS 5.0) rät von erzwungener
  Zeichen-Komplexität ab (führt zu Mustern wie `Passwort1!`) und gewichtet Länge +
  Leak-Check höher. Die klassische Komplexitätspflicht ist hier eine **bewusste
  Gründer-Entscheidung** — festgehalten, damit sie nachvollziehbar bleibt.

## CORP — Corporate-Workspace

*Umfang: Überschuss als Listing einstellen, anonymisierten Bedarfs-Katalog browsen,
route-basiertes „Was jetzt?"-Dashboard, Team/Sitze, Plan/Settings.*

— Anforderungen folgen nach Format-Freigabe —

## NGO — NGO-Workspace

*Umfang: Verifizierungs-Prozess durchlaufen, Bedarfe posten (inkl. „Menge egal" &
Dringlichkeit), Match bestätigen, Empfang bestätigen.*

*Bereich beschlossen am 2026-07-20 (Abstimmung C1–C5, D2–D3) → ADR 0027/0028. Feingranular (B1).*

### REQ-NGO-01 — Verifizierungs-Prozess durchlaufen

- **Rolle:** NGO, Admin
- **Beschreibung:** Als NGO möchte ich eine Verifizierung durchlaufen, damit belegt ist,
  dass wir eine echte, gemeinnützige Organisation sind, bevor wir handeln dürfen.
- **Akzeptanzkriterien:**
  - [x] Feste Stationsfolge `onboarding → verification_pending → pending_info → review → verified/rejected`
  - [x] Ops entscheidet über `set_ngo_verification` (approve / request_info / reject / start_review), admin-only
  - [x] Jede Entscheidung schreibt ein Audit-Event
  - [ ] NGO-seitiger Einreich-Fluss (Daten + Dokument hochladen) end-to-end live getestet
- **Status:** 🟡 (Ops-Entscheidungsseite gebaut; NGO-Einreichung inkl. Dokument offen — siehe REQ-NGO-02)
- **Priorität:** Must
- **Bezug:** ADR 0027 (C1) · Migration 0013 (`set_ngo_verification`) · `POST /api/ngos/[ngoId]/verification` · `NgoVerificationControls.tsx`

### REQ-NGO-02 — Gemeinnützigkeits-Nachweis ist Pflicht

- **Rolle:** NGO, Admin
- **Beschreibung:** Als NGO möchte ich einen Nachweis (z. B. Freistellungsbescheid)
  hochladen, damit Ops die Gemeinnützigkeit vor der Freigabe prüfen kann — als Ausgleich
  dafür, dass NGOs Freemail nutzen dürfen.
- **Akzeptanzkriterien:**
  - [ ] Upload eines Nachweis-Dokuments ist **Pflicht**, bevor die Verifizierung freigegeben werden kann
  - [ ] Dokument ist nur für die NGO und Ops sichtbar (privater Bucket)
  - [~] Upload-Infrastruktur vorhanden (privater Bucket + `add_match_evidence`), aber **kein** Verification-Gating-Upload
- **Status:** 🔴 offen (Infra da, Verifizierungs-Pflicht-Upload fehlt)
- **Priorität:** Must
- **Bezug:** ADR 0027 (C4) · Migration 0007 (privater Bucket, Infra)

### REQ-NGO-03 — Bedarf posten (Menge, „Menge egal", Dringlichkeit)

- **Rolle:** NGO
- **Beschreibung:** Als NGO möchte ich einen Bedarf mit Menge (oder „Menge egal") und
  Dringlichkeit einstellen, damit passende Corporate-Überschüsse gefunden werden können.
- **Akzeptanzkriterien:**
  - [x] Bedarf anlegen über Create-RPC; Felder für offene Menge und Dringlichkeit vorhanden
  - [ ] „Menge egal" als expliziter Zustand in der UI abgebildet
  - [ ] Live in der eingeloggten NGO-Ansicht erreichbar (hängt an AUTH-live)
- **Status:** 🟡 (DB-Logik + Felder gebaut; UI/Live offen)
- **Priorität:** Should
- **Bezug:** Migration 0003 (Create-RPCs) · Migration 0017 (Urgency/offene Menge)

### REQ-NGO-04 — Wareneingang bestätigen (mit Schutz), löst Bescheinigung aus

- **Rolle:** NGO, System
- **Beschreibung:** Als NGO möchte ich den Wareneingang bestätigen, damit die Vermittlung
  abgeschlossen und die Zuwendungsbestätigung ausgelöst wird — abgesichert, weil dieser
  Schritt steuerlich relevant ist.
- **Akzeptanzkriterien:**
  - [x] Übergang zu `delivered`/`completed` über die Match-Statemachine
  - [x] Abschluss erzeugt das Zuwendungs-/CSRD-Dokument (in Prüfung → Gegenzeichnung)
  - [x] Zusätzliche E-Mail-Bestätigung (Step-up/Reauth) für diese kritische Aktion (C5): `transition_match` verlangt für `delivered → completed` einen E-Mail-Link-/OTP-Login (JWT `amr`) der letzten 10 Minuten, sonst `step_up_required` (403); die UI schickt den Bestätigungslink
- **Status:** 🟢 (gebaut; live-verifiziert offen)
- **Priorität:** Must
- **Bezug:** ADR 0027 (C5) · Migration 0002 (Statemachine) · Migration 0008 (Gegenzeichnung) · Migration 0037 (Step-up) · siehe REQ-DOC-01/02

## MATCH — Match-Lebenszyklus

*Umfang: die eine Statemachine (proposed → ngo_confirmed → both_confirmed → in_transit →
delivered → completed; cancelled nur Admin), Kontakt-Gate bei both_confirmed,
Quota-Verbrauch, Match-Chat (Nachrichten + Realtime), Impact-Anzeige.*

*Bereich beschlossen am 2026-07-20 (Abstimmung D1–D6, E1) → ADR 0028. Feingranular (B1).*

### REQ-MATCH-01 — Match wird vorgeschlagen und von Ops freigegeben

- **Rolle:** System, Admin
- **Beschreibung:** Als Admin möchte ich, dass das System aus passenden Bedarfen und
  Überschüssen einen Match **vorschlägt**, den ich prüfe und **freigebe**, damit am Anfang
  Qualität und Vertrauen gesichert sind (kuratierter Start statt Vollautomatik).
- **Akzeptanzkriterien:**
  - [ ] System erzeugt Match-Vorschläge (`proposed`) nach Bedarf/Angebot-Kriterien
  - [ ] Ein Match wird für die Parteien erst nach Ops-Freigabe sichtbar/aktiv
  - [ ] Vollautomatische Erzeugung ohne Mensch ist **nicht** aktiv (späterer Ausbaupfad)
  - [ ] Audit-Event bei Erzeugung und Freigabe
- **Status:** 🔴 offen
- **Priorität:** Must
- **Bezug:** ADR 0028 (D1)
- **Notizen:** setzt genügend Corporate-Angebot voraus, sonst läuft die Vermittlung leer.

### REQ-MATCH-02 — Feste Stationen-Abfolge (eine Statemachine)

- **Rolle:** System, Corporate, NGO
- **Beschreibung:** Als System möchte ich jeden Match durch eine feste Stationsfolge
  führen, damit der Ablauf nachvollziehbar und einheitlich ist.
- **Akzeptanzkriterien:**
  - [ ] Übergänge nur entlang `proposed → ngo_confirmed → both_confirmed → in_transit → delivered → completed`
  - [ ] `cancelled` ist nur durch Admin/Ops erreichbar
  - [ ] Es existiert **genau eine** Statemachine (AGENTS.md-Invariante), keine Parallelpfade
  - [ ] Jeder Übergang schreibt ein Audit-Event `match.transition`
- **Status:** 🔴 offen
- **Priorität:** Must
- **Bezug:** ADR 0028 (D2) · ADR 0026 · AGENTS.md

### REQ-MATCH-03 — Kontakt-Gate: echte Kontaktdaten erst ab beidseitiger Zusage

- **Rolle:** Corporate, NGO, System
- **Beschreibung:** Als NGO möchte ich, dass meine echten Kontaktdaten erst sichtbar werden,
  nachdem **beide** Seiten bestätigt haben, damit die Privatsphäre bis zur Verbindlichkeit
  geschützt bleibt.
- **Akzeptanzkriterien:**
  - [ ] Vor `both_confirmed` sind NGO-Kontaktdaten anonymisiert
  - [ ] Ab `both_confirmed` werden die echten NGO-Kontaktdaten freigeschaltet
  - [ ] Durchsetzung server-seitig (RLS/Trust-Boundary), nicht nur in der UI
- **Status:** 🔴 offen
- **Priorität:** Must
- **Bezug:** ADR 0028 (D2) · AGENTS.md (Trust-Boundary)

### REQ-MATCH-04 — Teil-Deckung eines Bedarfs

- **Rolle:** Corporate, NGO, System
- **Beschreibung:** Als NGO möchte ich, dass ein großer Bedarf von **mehreren** Corporates
  in Teilmengen gedeckt werden kann, damit realistische Bedarfe (große Menge, viele kleine
  Spender) erfüllt werden.
- **Akzeptanzkriterien:**
  - [x] Ein Bedarf kann mehrere Matches tragen; die Restmenge wird heruntergezählt (`matches.quantity`, `need_open_quantity`, im Bedarfsverzeichnis und in der NGO-Bedarfsliste sichtbar)
  - [x] Überbuchung über die offene Restmenge hinaus wird verhindert (`need_fully_covered`, `quantity_exceeds_open`) — ein Teil ist ab dem Vorschlag reserviert
  - [x] Jede bestätigte Teil-Vermittlung ist ein eigener Match im Lebenszyklus; der Bedarf wird erst `matched`/`fulfilled`, wenn die Teile ihn decken
- **Status:** 🟢 (gebaut; live-verifiziert offen)
- **Priorität:** Should
- **Bezug:** ADR 0028 (D3) · Migration 0039 · siehe REQ-PLAN-* (Quota)

### REQ-MATCH-05 — Quota-Verbrauch je bestätigter Vermittlung

- **Rolle:** Corporate, System
- **Beschreibung:** Als System möchte ich pro **bestätigter** (Teil-)Vermittlung genau eine
  Einheit der Corporate-Jahres-Quota verbrauchen, damit Entitlements server-seitig
  durchgesetzt sind.
- **Akzeptanzkriterien:**
  - [ ] Genau 1 Quota-Einheit pro bestätigtem Match (auch bei Teil-Lieferung)
  - [ ] Verbrauch server-enforced, nicht umgehbar über die UI
  - [ ] Konsistent mit ADR 0026 (Zählweise)
- **Status:** 🔴 offen
- **Priorität:** Must
- **Bezug:** ADR 0028 (D3) · ADR 0026

### REQ-MATCH-06 — Abbruch: Storno vs. Scheitern, faire Erstattung

- **Rolle:** Corporate, NGO, Admin, System
- **Beschreibung:** Als Corporate möchte ich, dass zwischen einer Rücknahme vor Versand und
  einem Scheitern nach Versand unterschieden wird und mein Kontingent nur fair erstattet
  wird, damit Regeln und Erfolgs-Statistik sauber bleiben.
- **Akzeptanzkriterien:**
  - [x] Rücknahme vor `in_transit` = Storno (`cancelled`) → **keine** Quota-Erstattung; ab `in_transit` nicht mehr stornierbar (`already_shipped`)
  - [x] Scheitern ab `in_transit` **ohne NGO-Verschulden** → Quota-Erstattung (`fail_match`, `quota_refunded_at`)
  - [x] Zustände „storniert" (`cancelled`) und „gescheitert" (`failed`) getrennt erfasst
  - [x] Ops entscheidet über Verschulden; jede Entscheidung mit Audit-Event (`match.failed`, `match.failure_assessed:*`)
- **Status:** 🟢 (gebaut; live-verifiziert offen)
- **Priorität:** Should
- **Bezug:** ADR 0028 (D4) · Migration 0041

### REQ-MATCH-07 — Verfall liegengebliebener Vermittlungen (14 Tage)

- **Rolle:** System, Corporate, NGO
- **Beschreibung:** Als System möchte ich einen `proposed`-Match nach 14 Tagen ohne Reaktion
  automatisch verfallen lassen (mit Vorwarnung), damit die Liste sauber bleibt und keine
  Quota blockiert wird.
- **Akzeptanzkriterien:**
  - [ ] `proposed` ohne Reaktion → nach 14 Tagen automatisch `expired`/verfallen
  - [ ] Vor Ablauf geht eine Erinnerung an die säumige Seite
  - [ ] Verfall verbraucht **keine** Quota
- **Status:** 🔴 offen
- **Priorität:** Should
- **Bezug:** ADR 0028 (D5) · siehe REQ-OPS-* (Verfall-Job)

### REQ-MATCH-08 — Umwelt-Nutzen aus gepflegter Werte-Tabelle

- **Rolle:** Corporate, System, Admin
- **Beschreibung:** Als Corporate möchte ich den Umwelt-Nutzen (z. B. eingespartes CO₂) aus
  **festen, gepflegten Faktoren pro Warenkategorie** angezeigt bekommen, damit die Zahlen
  einheitlich und glaubwürdig sind.
- **Akzeptanzkriterien:**
  - [ ] Impact-Werte stammen aus einer gepflegten Faktor-Tabelle, **keine** freie Eingabe
  - [ ] Faktoren sind durch Ops pflegbar
  - [ ] Der Impact-Wert ist getrennt vom steuerlichen Spendenwert (→ ADR 0029)
- **Status:** 🔴 offen
- **Priorität:** Could
- **Bezug:** ADR 0028 (D6) · ADR 0029 (Abgrenzung zum Spendenwert)

## DOC — Dokumente & Compliance

*Umfang: automatische Spendenbescheinigung + CSRD-Note bei completed, CSRD-Report-Export
(offen), E-Signatur via DocuSeal (offen), Marketing-Assets/Social-Cards (tree).*

*Bereich beschlossen am 2026-07-20 (Abstimmung E3, D6) → ADR 0029/0028. Gemischt (B1).*

### REQ-DOC-01 — Spendenwert nur mit hinterlegtem Beleg

- **Rolle:** NGO, Corporate, Admin, System
- **Beschreibung:** Als Plattform möchte ich, dass ein Spendenwert **nie ungeprüft** auf die
  Zuwendungsbestätigung kommt, sondern ein Beleg (Kaufbeleg/Rechnung/Marktwert-Nachweis)
  hinterlegt ist, damit das Ausstellerhaftungs-Risiko sinkt.
- **Akzeptanzkriterien:**
  - [ ] Ohne hinterlegten Beleg **keine** wertbasierte Bescheinigung
  - [ ] Beleg wird hochgeladen und von Ops geprüft, bevor der Wert übernommen wird (siehe REQ-OPS-08)
  - [~] Upload-Infrastruktur vorhanden (privater Bucket, `add_match_evidence`), aber **kein** Beleg-Gate vor der Bescheinigung
  - [ ] Finale Belegarten/Prüftiefe mit Steuerberater klären (offen, siehe REQ-LEGAL-03)
- **Status:** 🔴 offen (Beleg-Gate fehlt; nur Upload-Infra vorhanden)
- **Priorität:** Must
- **Bezug:** ADR 0029 (E3) · Migration 0007 (Upload-Infra) · Migration 0008 (Bescheinigung)

### REQ-DOC-02 — Zuwendungsbestätigung erzeugen & gegenzeichnen

- **Rolle:** NGO, System
- **Beschreibung:** Als NGO möchte ich, dass bei Abschluss automatisch eine
  Zuwendungsbestätigung erzeugt wird, die ich mit meinen Aussteller-Angaben gegenzeichne,
  damit sie steuerlich gültig ist.
- **Akzeptanzkriterien:**
  - [x] Abschluss erzeugt ein Bescheinigungs-Dokument (Status „in Prüfung")
  - [x] NGO-Aussteller-Felder (Freistellungsbescheid-Referenz, Finanzamt, Registernr., Zeichnungsberechtigte:r) hinterlegbar
  - [x] `confirm_donation_certificate` setzt das Dokument auf „veröffentlicht"; Download rendert PDF
  - [ ] An das Beleg-Gate aus REQ-DOC-01 gekoppelt
- **Status:** 🟡 (Erzeugung + Gegenzeichnung + Download gebaut; Beleg-Kopplung fehlt)
- **Priorität:** Must
- **Bezug:** Migration 0004 (Erzeugung) · Migration 0008 (Gegenzeichnung) · `GET /api/documents/[documentId]/download`

### REQ-DOC-03 — CSRD-Note bei Abschluss

- **Rolle:** Corporate, System
- **Beschreibung:** Als Corporate möchte ich bei Abschluss eine CSRD-taugliche Notiz zum
  Vorgang erhalten, damit ich den Beitrag in der Nachhaltigkeits-Berichterstattung nutzen kann.
- **Akzeptanzkriterien:**
  - [x] Abschluss erzeugt zusätzlich ein Report-Dokument (CSRD-Note)
  - [ ] Voller CSRD-/ESRS-Report-Export (über die Einzelnotiz hinaus)
  - [ ] Der ausgewiesene Umwelt-Nutzen stammt aus der Faktor-Tabelle (siehe REQ-MATCH-08), getrennt vom Spendenwert
- **Status:** 🟡 (Einzelnotiz gebaut; voller Export offen)
- **Priorität:** Should
- **Bezug:** Migration 0004 · ADR 0028 (D6, Impact getrennt) · ADR 0029 (Wert getrennt)

### REQ-DOC-04 — E-Signatur (DocuSeal)

- **Rolle:** NGO, Corporate, System
- **Beschreibung:** Als Partei möchte ich Dokumente rechtssicher elektronisch signieren,
  damit Vereinbarungen ohne Medienbruch verbindlich werden.
- **Akzeptanzkriterien:**
  - [~] Datenmodell vorhanden (`signature_envelopes` + Empfänger, Provider `docuseal`/`documenso`/`manual`)
  - [ ] Anbindung an einen Signatur-Provider (RPC + Route) implementiert
  - [ ] Signatur-Status fließt in den Dokument-Lebenszyklus zurück
- **Status:** 🔴 offen (nur Tabellen; keine RPC/Route)
- **Priorität:** Could
- **Bezug:** Migration 0001 (`signature_envelopes`)

## OPS — Admin / Ops

*Umfang: Admin-Bootstrap (Allowlist + Token), Ops-Queue, Risk-Queue, NGO-Verifizierung
entscheiden, Matching kuratieren, Firmen-Plan setzen, Einladungen verwalten, Audit-Trail,
Match stornieren.*

*Bereich beschlossen am 2026-07-20 (Abstimmung C1–C5, D1/D4–D6, E2–E3) → ADR 0027/0028/0029. Gemischt (B1).*

### REQ-OPS-01 — Admin-Bootstrap (Allowlist + Token)

- **Rolle:** Admin, System
- **Beschreibung:** Als Betreiber möchte ich den ersten Admin nur über eine Allowlist plus
  Geheim-Token anlegen können, damit niemand sich selbst zum Verwalter macht.
- **Akzeptanzkriterien:**
  - [x] Bootstrap verlangt Token (`x-surplus-bootstrap-token`) **und** E-Mail in der Allowlist
  - [x] Legt einen Nutzer mit Rolle `admin` an und schreibt ein Audit-Event
  - [x] Kein Self-Service-Admin über den normalen Signup-Weg
- **Status:** 🟡 (gebaut; live-verifiziert offen)
- **Priorität:** Must
- **Bezug:** `POST /api/admin/bootstrap` · `ops/bootstrap/page.tsx`

### REQ-OPS-02 — Ops-/Risk-Queue

- **Rolle:** Admin
- **Beschreibung:** Als Verwalter möchte ich eine nach Risiko sortierte Arbeitsliste sehen
  (offene NGO-Verifizierungen, Agent-Vorschläge, geflaggte Listings), damit ich das
  Wichtigste zuerst bearbeite.
- **Akzeptanzkriterien:**
  - [x] Queue aggregiert NGO-Verifizierungen (`verification_pending`/`pending_info`/`review`), offene Agent-Aktionen, geflaggte Listings
  - [x] Risiko-Einstufung `high`/`medium`/`low`, sortiert nach Risiko + Datum
  - [ ] Corporate-Verifizierungen erscheinen ebenfalls in der Queue (hängt an REQ-OPS-04)
- **Status:** 🟡 (gebaut; Corporate-Zweig fehlt)
- **Priorität:** Should
- **Bezug:** `ops-risk-queue.ts` (`buildOpsRiskQueue`) · `AdminDashboard.tsx`

### REQ-OPS-03 — NGO-Verifizierung entscheiden

- **Rolle:** Admin
- **Beschreibung:** Als Verwalter möchte ich eine NGO freigeben, Infos nachfordern oder
  ablehnen, damit nur echte Organisationen handeln dürfen.
- **Akzeptanzkriterien:**
  - [x] Aktionen approve / request_info / reject / start_review, admin-only
  - [x] Row-Lock + Audit-Event je Entscheidung
  - [ ] Pflicht-Sichtung des Nachweis-Dokuments vor „approve" (hängt an REQ-NGO-02)
- **Status:** 🟡 (Entscheidungs-RPC gebaut; Dokument-Pflicht-Kopplung fehlt)
- **Priorität:** Must
- **Bezug:** Migration 0013 (`set_ngo_verification`) · `POST /api/ngos/[ngoId]/verification`

### REQ-OPS-04 — Corporate-Verifizierung entscheiden (VIES-gestützt)

- **Rolle:** Admin, System
- **Beschreibung:** Als Verwalter möchte ich Corporates automatisch freigeben, wenn alles
  grün ist (gültige USt-IdNr. via VIES, Firmen-Domain, keine Freemail), und nur Zweifelsfälle
  von Hand prüfen, damit der Normalfall ohne Handarbeit läuft.
- **Akzeptanzkriterien:**
  - [ ] Automatische Prüfung: USt-IdNr. via EU-VIES, Firmen-Domain, Website-Existenz
  - [ ] „Alles grün" → automatische Freigabe; sonst → manuelle Ops-Sichtung
  - [ ] Eigene Corporate-Verifizierungs-Pipeline (State-Feld + `set_company_verification`-RPC), analog NGO
  - [ ] Audit-Event je Entscheidung
- **Status:** 🔴 offen (weder Schema noch RPC noch VIES-Anbindung)
- **Priorität:** Must
- **Bezug:** ADR 0027 (C3)

### REQ-OPS-05 — Match-Vorschläge kuratieren & freigeben

- **Rolle:** Admin, System
- **Beschreibung:** Als Verwalter möchte ich System-Vorschläge für Matches prüfen und
  freigeben, damit der Start kuratiert ist (Qualität und Vertrauen vor Vollautomatik).
- **Akzeptanzkriterien:**
  - [ ] System erzeugt Vorschläge (`proposed`) aus Bedarf/Angebot — Erzeugungs-Flow existiert noch nicht (heute nur Seed)
  - [ ] Ein Match wird erst nach Ops-Freigabe für die Parteien aktiv
  - [ ] Vollautomatische Erzeugung ist **nicht** aktiv
- **Status:** 🔴 offen (kein `matches.create`/Kuratierungs-Flow; nur Statemachine ab `proposed`)
- **Priorität:** Must
- **Bezug:** ADR 0028 (D1) · siehe REQ-MATCH-01

### REQ-OPS-06 — Verfall-Job für liegengebliebene Vorschläge (14 Tage)

- **Rolle:** System, Admin
- **Beschreibung:** Als System möchte ich `proposed`-Matches nach 14 Tagen ohne Reaktion
  automatisch verfallen lassen, damit keine Quota blockiert wird und die Liste sauber bleibt.
- **Akzeptanzkriterien:**
  - [ ] Zeitgesteuerter Job setzt `proposed` nach 14 Tagen auf verfallen/`expired`
  - [ ] Verfall verbraucht **keine** Quota
  - [ ] Vorwarnung geht vor Ablauf raus (siehe REQ-NOTIFY-02)
- **Status:** 🔴 offen
- **Priorität:** Should
- **Bezug:** ADR 0028 (D5) · siehe REQ-MATCH-07

### REQ-OPS-07 — CO₂-/Impact-Werte-Tabelle pflegen

- **Rolle:** Admin
- **Beschreibung:** Als Verwalter möchte ich die Umwelt-Nutzen-Faktoren pro Warenkategorie
  pflegen, damit die ausgewiesenen Zahlen einheitlich und glaubwürdig sind.
- **Akzeptanzkriterien:**
  - [ ] Faktoren pro Kategorie in einer gepflegten Tabelle (keine freie Eingabe)
  - [ ] Ops kann Faktoren aktualisieren
  - [ ] Werte getrennt vom steuerlichen Spendenwert (→ ADR 0029)
- **Status:** 🔴 offen
- **Priorität:** Could
- **Bezug:** ADR 0028 (D6) · siehe REQ-MATCH-08

### REQ-OPS-08 — Beleg-Prüfung vor Zuwendungsbestätigung

- **Rolle:** Admin
- **Beschreibung:** Als Verwalter möchte ich den hinterlegten Wert-Beleg prüfen, bevor ein
  Spendenwert bescheinigt wird, damit kein ungeprüfter Wert steuerlich wirksam wird.
- **Akzeptanzkriterien:**
  - [ ] Beleg ist einsehbar und wird vor der Bescheinigung freigegeben/abgelehnt
  - [ ] Ohne Freigabe keine wertbasierte Bescheinigung (Kopplung an REQ-DOC-01)
  - [ ] Entscheidung mit Audit-Event
- **Status:** 🔴 offen
- **Priorität:** Should
- **Bezug:** ADR 0029 (E3) · siehe REQ-DOC-01

### REQ-OPS-09 — Firmen-Plan setzen (manuelle Freischaltung)

- **Rolle:** Admin
- **Beschreibung:** Als Verwalter möchte ich den Tarif einer Firma von Hand setzen, damit wir
  zum Start ohne automatische Bezahlung freischalten können (E2: erst Hand, dann Stripe).
- **Akzeptanzkriterien:**
  - [x] `set_company_plan` setzt `registered`/`seed`/`tree`, admin-only
  - [x] Downgrade blockiert, wenn zu viele Sitze belegt sind (`seat_limit`)
  - [x] Audit-Event `company.plan_set:<plan>`
- **Status:** 🟡 (gebaut; automatische Bezahlung = REQ-PLAN-06)
- **Priorität:** Must
- **Bezug:** ADR 0028/Abstimmung (E2) · Migration 0020 (`set_company_plan`) · `POST /api/companies/[companyId]/plan`

### REQ-OPS-10 — Audit-Trail für jede sicherheitsrelevante Mutation

- **Rolle:** System, Admin
- **Beschreibung:** Als Betreiber möchte ich, dass jede sicherheitsrelevante Änderung ein
  Audit-Event schreibt, damit Entscheidungen nachvollziehbar und prüfbar sind (AGENTS.md-Invariante).
- **Akzeptanzkriterien:**
  - [x] `audit_events`-Tabelle mit Actor/Action/Target/Sichtbarkeit
  - [x] Sicherheitsrelevante RPCs schreiben Events (Provisioning, Verifizierung, Plan, Bootstrap)
  - [ ] Lückenlose Abdeckung aller künftigen Mutationen (Matching-Erzeugung, Erstattung) mitziehen
- **Status:** 🟡 (Kern gebaut; mit neuen Flows fortschreiben)
- **Priorität:** Must
- **Bezug:** Migration 0001 (`audit_events`) · AGENTS.md

## AGENT — KI-Agent

*Umfang: Agent-Run erzeugt Findings + vorgeschlagene Aktionen, führt nie ohne
menschliche Freigabe aus (Invariante), approve/reject/execute-Fluss, Risiko-Level.*

— Anforderungen folgen nach Format-Freigabe —

## PLAN — Pläne & Entitlements

*Umfang: registered / seed / tree, Matches-pro-Jahr-Quota (server-enforced), User-Sitze,
Feature-Gating (Kontaktzugriff, CSRD-Level, Zertifikat, Employer Branding), Upgrade-Pfad.*

*Bereich beschlossen am 2026-07-20 (Abstimmung D3–D4, E2) → ADR 0028/0026. Gemischt (B1).*

### REQ-PLAN-01 — Drei Pläne mit Entitlements

- **Rolle:** Corporate, System
- **Beschreibung:** Als System möchte ich die Pläne `registered`/`seed`/`tree` mit festen
  Kontingenten führen, damit Fähigkeiten klar an den Tarif gekoppelt sind.
- **Akzeptanzkriterien:**
  - [x] `registered`: 0 Matches/Jahr, 1 Sitz, nur browsen
  - [x] `seed`: 12 Matches/Jahr, 2 Sitze, betreutes Matching
  - [x] `tree`: unbegrenzte Matches, 5 Sitze, kuratiertes Matching, höchstes CSRD-Level
- **Status:** 🟡 (Entitlements definiert; live-Gating in Teilen offen)
- **Priorität:** Must
- **Bezug:** Migration 0014 (`registered`) · `PLAN_ENTITLEMENTS` (packages/domain)

### REQ-PLAN-02 — Jahres-Quota server-seitig durchsetzen

- **Rolle:** Corporate, System
- **Beschreibung:** Als System möchte ich die Matches-pro-Jahr-Quota server-seitig
  durchsetzen, damit sie nicht über die UI umgangen werden kann.
- **Akzeptanzkriterien:**
  - [x] Beim Übergang `both_confirmed` prüft der RPC die Quota im rollierenden 12-Monats-Fenster
  - [x] Überschreitung wirft `match_quota_exceeded` (HTTP 402); `committed_at` wird gesetzt
  - [x] Genau 1 Einheit pro bestätigtem Match (auch Teil-Lieferung), konsistent mit ADR 0026
- **Status:** 🟡 (Enforcement gebaut; hängt am fehlenden Match-Erzeugungs-Flow)
- **Priorität:** Must
- **Bezug:** Migration 0002 (`transition_match`) · ADR 0026 · siehe REQ-MATCH-05

### REQ-PLAN-03 — Quota-Erstattung: Storno vs. Scheitern

- **Rolle:** Corporate, Admin, System
- **Beschreibung:** Als Corporate möchte ich mein Kontingent nur bei fairem Scheitern
  zurückerhalten, damit Regeln und Erfolgs-Statistik sauber bleiben.
- **Akzeptanzkriterien:**
  - [ ] Rücknahme vor `in_transit` = Storno → **keine** Erstattung
  - [ ] Scheitern ab `in_transit` ohne NGO-Verschulden → Erstattung
  - [ ] Zustände „storniert" vs. „gescheitert" getrennt erfasst
- **Status:** 🔴 offen
- **Priorität:** Should
- **Bezug:** ADR 0028 (D4) · siehe REQ-MATCH-06

### REQ-PLAN-04 — User-Sitze pro Plan

- **Rolle:** Corporate, System
- **Beschreibung:** Als Corporate möchte ich Teammitglieder bis zum Sitz-Limit meines Plans
  einladen, damit das Team gemeinsam arbeiten kann.
- **Akzeptanzkriterien:**
  - [x] Sitz-Limit wird beim Einladungs-Annehmen und beim Plan-Downgrade geprüft
  - [x] Überschreitung wirft `seat_limit_exceeded`
  - [ ] Sitz-Verwaltungs-UI live erreichbar
- **Status:** 🟡 (Enforcement gebaut; UI/Live offen)
- **Priorität:** Should
- **Bezug:** Migration 0019 · Migration 0020 · siehe REQ-AUTH-04

### REQ-PLAN-05 — Feature-Gating nach Plan

- **Rolle:** Corporate, System
- **Beschreibung:** Als System möchte ich Funktionen (Kontaktzugriff, CSRD-Level, Matching)
  am Plan festmachen, damit höhere Pläne mehr können.
- **Akzeptanzkriterien:**
  - [x] `registered` = anonymer Katalog/Directory, kein Matching
  - [x] Kontakt-Gate + Bedarfs-Directory an Plan/Match-Status gekoppelt
  - [ ] Vollständiges Gating aller Features live geprüft
- **Status:** 🟡 (Kern gebaut; Vollabdeckung offen)
- **Priorität:** Should
- **Bezug:** Migration 0015 (registered-Gating) · Migration 0016 (Contact-Gate/Directory)

### REQ-PLAN-06 — Bezahlung: erst manuell, dann Stripe

- **Rolle:** Corporate, Admin, System
- **Beschreibung:** Als Betreiber möchte ich Tarife zuerst von Hand freischalten und später
  automatisch über Stripe abrechnen, damit wir schnell starten und danach skalieren.
- **Akzeptanzkriterien:**
  - [x] Manuelle Freischaltung über `set_company_plan` (siehe REQ-OPS-09)
  - [ ] Automatische Bezahlung (Stripe) als Folgeschritt
  - [ ] NGOs bleiben kostenlos
- **Status:** 🔴 offen (nur manuell; Stripe-Anbindung fehlt)
- **Priorität:** Should
- **Bezug:** Abstimmung (E2) · Migration 0020

## LEGAL — Recht & Haftung

*Umfang: verpflichtende AGB-/Nutzungsbedingungen-Zustimmung (Clickwrap), Ausstellerhaftung
für den Spendenwert, Beleg-/Nachweis-Pflicht, finale Steuerberater-Freigabe des Modells.*

*Bereich beschlossen am 2026-07-20 (Abstimmung E3) → ADR 0029. Gemischt (B1).*

### REQ-LEGAL-01 — Nutzungsbedingungen verpflichtend zustimmen (Clickwrap)

- **Rolle:** Corporate, NGO, System
- **Beschreibung:** Als Plattform möchte ich vor dem Handeln eine dokumentierte Zustimmung
  zu den Nutzungsbedingungen verlangen, damit die Vereinbarung nachweisbar ist.
- **Akzeptanzkriterien:**
  - [x] Zustimmung wird pro Version erfasst und protokolliert
  - [x] Zugang zu Kern-Funktionen ist an die aktuelle Zustimmung gekoppelt (Clickwrap-Gate)
  - [x] Versions-Bump erzwingt erneute Zustimmung
- **Status:** 🟡 (gebaut; live-verifiziert offen)
- **Priorität:** Must
- **Bezug:** Migration 0010 (Agreement-Tracking) · Migration 0012 (Clickwrap-Gate) · Migration 0018 (Version-Bump)

### REQ-LEGAL-02 — Ausstellerhaftung absichern (Beleg + Hinweis)

- **Rolle:** NGO, Corporate, System
- **Beschreibung:** Als Plattform möchte ich das Ausstellerhaftungs-Risiko der NGO
  abfedern, indem ein Wert nur mit Beleg bescheinigt wird und die Haftung klar benannt ist,
  damit niemand einen unbelegten Wert bescheinigt.
- **Akzeptanzkriterien:**
  - [ ] Wertbasierte Bescheinigung nur mit hinterlegtem Beleg (Kopplung an REQ-DOC-01)
  - [ ] Klarer Haftungs-Hinweis im Bescheinigungs-Fluss (Aussteller haftet vorrangig)
  - [ ] Trennung von Impact-Wert (CO₂) und steuerlichem Spendenwert bleibt gewahrt
- **Status:** 🔴 offen
- **Priorität:** Must
- **Bezug:** ADR 0029 (E3) · siehe REQ-DOC-01

### REQ-LEGAL-03 — Bewertungsmodell mit Steuerberater final klären

- **Rolle:** Admin
- **Beschreibung:** Als Gründer möchte ich die zulässigen Belegarten, eine mögliche
  Obergrenze/Plausibilitätsprüfung und die Haftungs-Formulierungen mit einem Steuerberater
  final festlegen, damit das Modell rechtssicher ist. **Nichts hier raten.**
- **Akzeptanzkriterien:**
  - [ ] Zulässige Belegarten definiert
  - [ ] Obergrenze/Plausibilitätsprüfung entschieden (ja/nein, wie)
  - [ ] Haftungs-Hinweise vom Steuerberater abgesegnet und in ADR 0029 nachgetragen
- **Status:** 🔴 offen (Founder-/Steuerberater-Call)
- **Priorität:** Must
- **Bezug:** ADR 0029 (Ausgestaltung offen)

## NOTIFY — Benachrichtigungen

*Umfang: Auth-Mails (Magic-Link, Bestätigung), Match-Erinnerungen, Verfall-Vorwarnung vor
Ablauf, Benachrichtigung bei Statuswechseln einer Vermittlung.*

*Bereich beschlossen am 2026-07-20 (Abstimmung D5, C5) → ADR 0028/0027. Grob (B1).*

### REQ-NOTIFY-01 — Auth-Mails (gebrandet, zuverlässig)

- **Rolle:** System
- **Beschreibung:** Als Nutzer möchte ich verlässliche, erkennbar von sur.plus stammende
  Anmelde-/Bestätigungs-Mails erhalten, damit ich mich anmelden und bestätigen kann.
- **Akzeptanzkriterien:**
  - [x] Auth-Mails sind gebrandet
  - [ ] Produktiver Mailversand über Custom-SMTP (statt rate-limitiertem Notversand)
  - [ ] Lokal im Mail-Fänger testbar
- **Status:** 🟡 (Branding gebaut; produktiver Versand offen — siehe REQ-AUTH-02)
- **Priorität:** Must
- **Bezug:** Abstimmung (Auth-Mails) · siehe REQ-AUTH-02

### REQ-NOTIFY-02 — Verfall-Vorwarnung vor Ablauf

- **Rolle:** System, Corporate, NGO
- **Beschreibung:** Als säumige Partei möchte ich vor dem 14-Tage-Verfall eines Vorschlags
  erinnert werden, damit ehrenamtliche Organisationen nicht unnötig etwas verlieren.
- **Akzeptanzkriterien:**
  - [ ] Erinnerung geht vor Ablauf an die säumige Seite
  - [ ] Zeitlich an den Verfall-Job gekoppelt (siehe REQ-OPS-06)
- **Status:** 🔴 offen
- **Priorität:** Should
- **Bezug:** ADR 0028 (D5) · siehe REQ-MATCH-07 / REQ-OPS-06

### REQ-NOTIFY-03 — Benachrichtigung bei Statuswechsel

- **Rolle:** Corporate, NGO
- **Beschreibung:** Als Beteiligte:r möchte ich bei wichtigen Statuswechseln einer
  Vermittlung benachrichtigt werden, damit ich rechtzeitig reagiere (z. B. bestätigen).
- **Akzeptanzkriterien:**
  - [ ] Benachrichtigung bei relevanten Übergängen (z. B. `proposed`, `both_confirmed`, `delivered`)
  - [ ] Für kritische Aktionen (Wareneingang) mit Step-up-Bestätigung verknüpft (C5, siehe REQ-NGO-04)
- **Status:** 🔴 offen
- **Priorität:** Could
- **Bezug:** ADR 0028 (D2) · ADR 0027 (C5)

## NFR — Nicht-funktionale Anforderungen

*Umfang: Sicherheits-Baseline (22 Controls), Trust-Boundary/RLS, Audit-Trail,
Datenschutz (cookieless, self-hosted fonts), Idempotenz & Rate-Limiting, i18n (nur
UI-Chrome), Performance, Betrieb/Deploy (Netlify, Staging-Gate), Rollback.*

*Teil „Sicherheit & Datenschutz" ausformuliert am 2026-07-21 (aus Login-Analyse + ADR 0006).
Übrige NFR (Performance, i18n, Betrieb/Deploy, Rollback) folgen noch.*

### Sicherheit & Datenschutz

### REQ-NFR-01 — Geheimnis-kritische Werte werden nur gehasht gespeichert

- **Rolle:** System
- **Beschreibung:** Als Plattform möchte ich alles, was geheim bleiben muss, nur als
  nicht-umkehrbaren Hash speichern, damit es selbst bei einem Datenbank-Diebstahl nicht
  rekonstruierbar ist.
- **Akzeptanzkriterien:**
  - [x] Passwörter werden von Supabase gehasht (bcrypt) — nie im Klartext
  - [x] Einladungs-Token liegen nur als SHA-256-Hash in `invitations.acceptance_token_hash` (Klartext-Token nur in der Mail)
  - [x] Magic-Link-/OTP-Codes werden von Supabase gehasht gespeichert
  - [x] Idempotenz-Anfragen werden als `request_hash` abgelegt
- **Status:** ✅ (im Schema verifiziert)
- **Priorität:** Must
- **Bezug:** Migration 0001 (`acceptance_token_hash`, `digest(...,'sha256')`, `pgcrypto`) · Supabase Auth

### REQ-NFR-02 — Personenbezogene Daten: Zugriffsschutz statt Hashing

- **Rolle:** System
- **Beschreibung:** Als Plattform möchte ich anzeigbare Daten (Name, E-Mail, Kontakt) nicht
  hashen (sie müssen lesbar bleiben), sondern über Zugriffsregeln und Verschlüsselung
  schützen, damit sie nur Berechtigte sehen.
- **Akzeptanzkriterien:**
  - [x] Zugriff über RLS beschränkt; niemand sieht fremde Daten
  - [x] NGO-/Corporate-Kontaktdaten sind bis zum Match-Unlock ausgeblendet (Redaction)
  - [x] Übertragung per HTTPS/TLS; Verschlüsselung im Ruhezustand auf Supabase-Ebene
  - [ ] Bewusst offen: keine feld-einzelne Verschlüsselung sensibler Spalten (Zugriffsschutz statt Feld-Krypto)
- **Status:** 🟡 (Zugriffsschutz gebaut; Feld-Verschlüsselung bewusst nicht)
- **Priorität:** Must
- **Bezug:** ADR 0006 (#2, #3) · AGENTS.md (Trust-Boundary)

### REQ-NFR-03 — Zwei-Faktor-Authentifizierung (2FA)

- **Rolle:** Admin, Corporate, NGO, System
- **Beschreibung:** Als Nutzer möchte ich meinen Zugang mit einem zweiten Faktor absichern,
  damit ein gestohlenes Passwort allein nicht reicht.
- **Akzeptanzkriterien:**
  - [x] TOTP-2FA (Authenticator-App) eingebaut; Step-up auf `aal2` server-seitig erzwungen (nicht umgehbar per Direkt-URL)
  - [ ] 2FA ist für **Admins Pflicht** (heute freiwillig)
  - [ ] Optional weitere Faktoren (WebAuthn/Phone) als spätere Ausbaustufe
- **Status:** 🟡 (2FA vorhanden & erzwungen wenn aktiv; Admin-Pflicht offen)
- **Priorität:** Must
- **Bezug:** `SmartLoginPanel.tsx` · `server-supabase.ts` (mfaRequired) · ADR 0006 (Launch: MFA für Admins)

### REQ-NFR-04 — Sichere Sitzungs- & Token-Behandlung

- **Rolle:** System
- **Beschreibung:** Als Plattform möchte ich Sitzungen serverseitig echt prüfen und Token
  kurzlebig halten, damit manipulierte oder alte Token nicht funktionieren.
- **Akzeptanzkriterien:**
  - [x] Server validiert das Token via `getUser()` und prüft Nutzer-ID-Konsistenz (nicht nur Cookie lesen)
  - [x] Zugangstoken kurzlebig (1 h); Refresh-Token-Rotation aktiv
  - [x] MFA-Gate wird server-seitig erzwungen (Weiterleitung, wenn `aal2` fehlt)
  - [ ] Session-Refresh über eine Middleware (heute keine vorhanden — loses Ende)
- **Status:** 🟡 (Kern gebaut; Middleware fehlt)
- **Priorität:** Must
- **Bezug:** `server-supabase.ts` · `supabase/config.toml` (JWT/Refresh)

### REQ-NFR-05 — Rate-Limiting gegen Missbrauch

- **Rolle:** System
- **Beschreibung:** Als Plattform möchte ich Login-Versuche und Schreibzugriffe begrenzen,
  damit automatisiertes Durchprobieren und Überlastung gebremst werden.
- **Akzeptanzkriterien:**
  - [x] Login-/OTP-/Refresh-Limits laufen über Supabase (pro IP, 5-Minuten-Fenster)
  - [x] Mutations-/Webhook-/AI-Endpunkte haben Rate-Limits (HTTP 429 + `Retry-After`)
  - [ ] In-Memory-Limiter vor horizontaler Skalierung durch einen geteilten Store ersetzen
- **Status:** 🟡 (gebaut; geteilter Store offen)
- **Priorität:** Should
- **Bezug:** ADR 0006 (#7) · `packages/domain/src/rate-limit.ts` · `apps/web/app/api/_lib/rate-limit.ts` · `supabase/config.toml` (`[auth.rate_limit]`)

### REQ-NFR-06 — Trust-Boundary & Rechte-Trennung

- **Rolle:** System
- **Beschreibung:** Als Plattform möchte ich Rechte pro Anfrage neu prüfen und nie der URL
  vertrauen, damit niemand über einen Link an fremde Rechte kommt.
- **Akzeptanzkriterien:**
  - [x] `ActorContext` pro Request; Objekt-Autorisierung in RLS **und** an der Repository-Grenze (defense in depth)
  - [x] Die Adresse (URL) gewährt keine Rechte (Rollen-Schranke, z. B. „Ops-Zugang erforderlich")
  - [x] Admin ist nie self-service (`claim_workspace` weist Admin ab; nur Bootstrap mit Token + Allowlist)
- **Status:** 🟡 (gebaut; laufend mit neuen Endpunkten fortschreiben)
- **Priorität:** Must
- **Bezug:** ADR 0006 (#1, #2) · Migration 0019 (`claim_workspace`) · `POST /api/admin/bootstrap`

### REQ-NFR-07 — Keine Konto-Enumeration

- **Rolle:** System
- **Beschreibung:** Als Plattform möchte ich nicht verraten, ob eine E-Mail registriert ist,
  damit Konten nicht ausgespäht werden können.
- **Akzeptanzkriterien:**
  - [x] Passwort-Reset meldet immer „Falls ein Konto existiert, ist der Link unterwegs"
  - [ ] Gleiches Verhalten bei künftigen Auth-Meldungen konsequent einhalten
- **Status:** ✅ (beim Reset umgesetzt)
- **Priorität:** Should
- **Bezug:** `SmartLoginPanel.tsx:281`

### REQ-NFR-08 — Geheimnisse bleiben serverseitig

- **Rolle:** System
- **Beschreibung:** Als Plattform möchte ich mächtige Schlüssel nie in den Browser geben,
  damit sie nicht abgegriffen werden können.
- **Akzeptanzkriterien:**
  - [x] Service-Role-Key ausschließlich serverseitig; Browser erhält nur anon/Session-Schlüssel
  - [x] Bootstrap-Token wird nur live gegen eine Umgebungs-Variable geprüft, nicht gespeichert
- **Status:** ✅
- **Priorität:** Must
- **Bezug:** ADR 0006 (#4)

### REQ-NFR-09 — Sicherheits-Profil pro Endpunkt (Vertrag)

- **Rolle:** System
- **Beschreibung:** Als Team möchte ich, dass jeder API-Endpunkt sein Sicherheits-Profil
  deklariert, damit kein Endpunkt versehentlich ungeschützt ausgeliefert wird.
- **Akzeptanzkriterien:**
  - [x] Jeder Endpunkt deklariert Rate-Limit-Policy + Sicherheits-Controls; Tests scheitern sonst
  - [x] Sicherheits-/Compliance-Mutationen schreiben Audit-Events (siehe REQ-OPS-10)
  - [x] Browser-Sicherheits-Header + CSP werden ausgeliefert
- **Status:** 🟡 (Vertrag gebaut; Abdeckung mit jedem neuen Endpunkt fortschreiben)
- **Priorität:** Must
- **Bezug:** ADR 0006 · `security-controls.ts` · `api-contract.ts` · `proxy.ts` · `next.config.mjs`

### REQ-NFR-10 — Launch-Härtung (vor Produktion)

- **Rolle:** Admin, System
- **Beschreibung:** Als Betreiber möchte ich vor dem echten Launch die restlichen
  Sicherheits-Schalter scharfstellen, damit Produktionsdaten geschützt sind.
- **Akzeptanzkriterien:**
  - [ ] Leaked-Password-Schutz aktivieren (Supabase prüft gegen bekannte geleakte Passwörter)
  - [ ] 2FA-Pflicht für Admins aktivieren
  - [ ] Redirect-Allowlist nur auf Produktions-Domains
  - [ ] Passwort-Richtlinie umsetzen (Länge 8 + Komplexität + Leak-Check + Formular-Hinweis) → siehe REQ-AUTH-07
  - [ ] Service-Role-/Webhook-Secrets vor Launch rotieren
  - [ ] Branch-Protection + Code-Scanning (CodeQL) scharf; externer Pentest vor echten NGO-Kontaktdaten
- **Status:** 🔴 offen (Infra-/Founder-Aufgaben, bewusst nicht raten)
- **Priorität:** Must
- **Bezug:** ADR 0006 („Required before production launch")

### Weitere NFR (Performance, i18n, Betrieb/Deploy, Rollback)

— Anforderungen folgen nach Format-Freigabe —

---

## Format-Entscheidungen (beschlossen 2026-07-20 mit Flo)

Diese Fragen waren offen und sind jetzt entschieden (Abstimmung Punkte B1–B5):

- **Granularität (B1):** **Gemischt** — wichtige Bereiche (AUTH, MATCH) feingranular und
  einzeln prüfbar, allgemeine Themen gröber.
- **Akzeptanzkriterien (B2):** **Freitext-Checklisten** (Häkchen-Liste, wie hier); kein
  Gherkin (lohnt erst mit automatisierten Tests).
- **Priorisierung (B3):** **MoSCoW** (Must / Should / Could / Won't).
- **Verknüpfung ADR ↔ REQ (B4):** **nur eine Richtung** — das `Bezug`-Feld im REQ genügt,
  keine Rückverweise in den ADRs pflegen.
- **Pflege (B5):** **Single-File** (dieses Dokument); Aufteilung pro Bereich erst bei
  echtem Wachstum.

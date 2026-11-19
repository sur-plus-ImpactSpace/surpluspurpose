# App-Redesign — Nordstern

Stand: 2026-07-10 · Autor: Engineering (Cowork) · Status: **Entwurf, wartet auf Freigabe**

Kein Bau-Ticket. Dieses Doc legt Ziel-Architektur, Informationsarchitektur, Demo-Modell
und Farb-/Typo-Richtung fest, damit wir das „10/10" nicht durch Umstreichen einer Struktur
erreichen, die sich noch bewegt. Bau-Reihenfolge steht am Ende.

> ## ⚠️ Befund 2026-07-10, der alles rahmt
> **In Produktion leiten `/` und `/login` auf `/demo` um — es ist kein Auth-Backend
> konfiguriert.** Der gesamte eingeloggte Teil (Login, echter Workspace, alle
> Auth-Dashboards, der Shell-/Login-Umbau dieser Woche) ist **live nicht erreichbar**.
> Es läuft nur die Demo. Der Code bestätigt das absichtlich: `if (!authConfig)
> redirect("/demo")`.
>
> Folgen:
> 1. **„Demo als echter Account" (Schritt 1) ist nicht baubar, bis Supabase-Auth in der
>    App-Site live ist.** Das ist ein Ops-/Infra-Schritt (Netlify-Env + Supabase-Projekt),
>    kein UI-Schritt.
> 2. **Solange Auth nicht live ist, ist die Demo das Produkt.** Alles, was Interessenten
>    sehen, ist `/demo` — dann wirken IA-/Polish-Arbeiten *an der Demo* sofort, Arbeit an
>    den Auth-Seiten wirkt nirgends.
> 3. Founder-Call, der alles davor entscheidet: **Auth jetzt live bringen** (Staging oder
>    Prod) — oder **prod bewusst demo-only lassen** und in die Demo investieren?

---

## Warum die App heute kein 10/10 ist

Nicht die Farbe. Drei strukturelle Gründe, alle diese Woche durch Bugs belegt:

1. **Die Navigation ist keine.** Der Workspace ist eine Scroll-Seite pro Rolle, die
   Sidebar-Einträge sind Anker (`#c-evidence` …). Das ist Demo-Mechanik. Jede neue Funktion
   verlängert die Seite, statt einen eigenen Ort zu bekommen. Kein Deep-Link, kein
   Zurück-Button, kein Laden pro Bereich, keine Rechte pro Route.
2. **Demo und Produkt teilen Code — und es leckt.** „Complete demo file set" und
   „Operational workspace with real example content" standen im echten Workspace, weil
   `EvidencePanel`/`WorkspaceProfile` von `/` und `/demo` geteilt werden. Der tote
   „Upload"-Knopf war dieselbe Klasse: Demo-Attrappe im Produkt.
3. **Die IA ist eine Panel-Wand.** Sie beantwortet nicht „was muss ich jetzt tun". Der
   Moat — CSRD/ESRS-Dokumentation — ist als „Evidence"-Pänelchen versteckt statt Headline.

---

## Ziel-Architektur

**Ein Produkt. Route-basiert. Demo ist ein Account, keine Oberfläche.**

### 1. Demo = geseedeter Gast-Account (löst #2)

`/demo` als Sonder-Code-Pfad entfällt. Stattdessen:

- Ein **Demo-/Gast-Login**, der eine geseedete Rolle öffnet (Corporate/NGO/Ops umschaltbar),
  nächtlich zurückgesetzt, deutlich als „Sandbox" markiert (Badge bleibt).
- Die Demo läuft damit durch **denselben** Code wie das echte Produkt — keine zweite
  Wortwahl, keine Attrappen, keine Leckage mehr möglich.
- Vorteil fürs Marketing: die LP verlinkt „Live-Demo ansehen" → Gast-Session. Was der
  Interessent sieht, *ist* das Produkt.

> Founder-Call: geteilter Demo-Login (ein Konto, jeder sieht dasselbe) **oder** pro
> Besucher eine kurzlebige Gast-Session (isoliert, teurer). Empfehlung: geteilter Login
> für Rollen-Demo, Reset per Cron — billig, reicht fürs Zeigen.

### 2. Echte Routen statt Scroll-Anker (löst #1)

Pro Rolle eine flache Route-Struktur statt einer Endlos-Seite:

```
Corporate            NGO                  Ops (intern)
/  (Was jetzt?)      /  (Was jetzt?)      /  (Queue)
/listings           /needs               /verification
/matches            /matches             /matching
/documents          /documents           /risk
/team               /team                /audit
/settings + /plan   /settings
```

- Die Sidebar wird echte Navigation. Der „Was jetzt?"-Home ersetzt die Panel-Wand:
  nächster erlaubter Schritt (`nextMatchActionForRole`) prominent, darunter ein kurzer
  Status-Überblick, nicht zwölf gleichwertige Kacheln.
- Deep-Links, Zurück-Button, Skeleton pro Route (B3 ist dafür schon da), Rechte serverseitig
  pro Route (Trust-Boundary aus `AGENTS.md` bleibt).

### 3. Compliance/Reports als Headline-Bereich (Moat sichtbar machen)

Eigener `/documents`-Bereich für Corporates: Spendenbescheinigung, CSRD-Note (kommt aus
Migration 0004, existiert schon), später ESRS-Export für den Nachhaltigkeitsbericht. Das
ist die Funktion, für die €575/Monat gezahlt werden — sie verdient eine eigene Seite, kein
Pänelchen.

### 4. Login/Registrierung sauber, ohne Demo

- **Login**: fokussiert. Magic-Link, „Einladung annehmen", Fehlerzustände. Kein
  „Explore the demo" mehr dazwischen (aktuell drin — raus).
- **Zugang**: invite-only bleibt. Für inbound Corporates ein separates „Zugang anfragen"
  (Lead-Capture), klar getrennt von der Demo.
- **Demo-Einstieg**: eigener Button „Live-Demo", nicht in der Anmeldemaske.

---

## Farbe & Typografie — die letzten 10 %

Erst nach der Struktur. Richtung:

- **Eine Marke, zwei Temperaturen (rollen-adaptiver Akzent).** sur.plus ist zweiseitig:
  Corporate = Compliance/audit-nüchtern, NGO = Mission/warm. Ein Akzent-Token pro Rolle
  (Corporate kühler, NGO wärmer), *gleiche* Basis, gleiche Qualität — NGOs nie „second
  class". Kein zweites Design-System, nur ein Token.
- **Serif dosieren.** DM Serif ist ein starkes Markenmoment für Auth, Login und
  Report-Cover. In **dichten Datenlisten** kostet sie Scan-Barkeit — dort Sans (Inter).
  Faustregel: Serif für Überschriften und Marke, Sans fürs Werkzeug.
- **Pine-Shell bleibt** — der dunkle Rahmen trägt „Plattform/ernst" und funktioniert für
  beide Seiten.

> Founder-Call: Akzent-Paar. Vorschlag Corporate = kühleres Grün/Teal Richtung
> `#1A5C4A`-Familie, NGO = wärmeres Moss/Clay. Kann ich als Muster nebeneinander rendern.

---

## Bau-Reihenfolge (empfohlen)

1. **Demo-Account + sauberer Login.** Voraussetzung: solange der `/demo`-Fork existiert,
   baue ich jede Route doppelt. Löst zugleich deine Vorgabe und die Leckage-Klasse.
2. **Route-basierte IA + „Was jetzt?"-Home** je Rolle, `/documents` als eigener Bereich.
3. **Visuelles Feintuning**: rollen-adaptiver Akzent, Serif-Dosierung, Dichte.

Erst danach ist „10/10" eine Frage von Politur statt von Fundament.

---

## Offene Founder-Calls

- Demo: geteilter Login vs. Gast-Session pro Besucher.
- Selbst-Registrierung: bleibt invite-only? „Zugang anfragen" als Lead-Capture ja/nein.
- Akzent-Paar Corporate/NGO — konkrete Farben.
- Serif im Workspace: ganz raus aus dichten Views, oder nur Listen?

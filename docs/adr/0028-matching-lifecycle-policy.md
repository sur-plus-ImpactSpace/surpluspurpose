# ADR 0028 — Vermittlungs-Lebenszyklus (Matching-Policy)

- **Status:** Accepted — Founder-Freigabe (Flo & Andi) am 2026-07-20
- **Datum:** 2026-07-20
- **Kontext-Docs:** `docs/planning/abstimmung-flo-2026-07-19-einfach.md` (Punkte D1–D6, E1),
  ADR 0026 (Match-Quota-Zählung), `AGENTS.md` (eine Match-Statemachine, Trust-Boundary),
  `anforderungskatalog.md` (Bereich `MATCH`)

## Kontext

Die Vermittlung (Match) — aus einem NGO-Bedarf und einem Corporate-Überschuss wird eine
verbindliche Zusammenarbeit — ist das Herzstück der Plattform, existiert aber heute **noch
nicht als echter Ablauf**: es gibt nur Seed-Daten, kein `matches.create`, keine bezahlte
Erzeugung. Vor dem Bau der Engine (E1) müssen die Spielregeln festliegen, damit Quota,
Erstattung, Verfall und Impact konsistent umgesetzt werden. Dieses ADR hält die in der
Abstimmung vom 2026-07-20 getroffenen Entscheidungen D1–D6 fest.

Recherche-Befund (Grundlage von D1): Fast alle etablierten Sachspenden-Plattformen
(Good360, In Kind Direct, Innatura) führen Angebot und Bedarf **kuratiert** zusammen, nicht
vollautomatisch. Das stützt einen betreuten Start.

## Entscheidung

1. **Erzeugung — betreut, nicht vollautomatisch (D1).** Das System **schlägt** Matches vor
   (Regeln/Heuristik), die verbindliche **Freigabe erfolgt durch einen Menschen** (Ops).
   Vollautomatische Vermittlung ist ausdrücklich **nicht** der Start-Modus; sie bleibt ein
   späterer Ausbaupfad, wenn Volumen und Vertrauen es tragen. Voraussetzung für Nutzen:
   zuerst genügend Corporate-Angebot aufbauen, sonst läuft die Vermittlung leer.

2. **Feste Stationen-Abfolge (D2), unverändert:**
   `proposed → ngo_confirmed → both_confirmed → in_transit → delivered → completed`;
   `cancelled` nur durch Ops. Es bleibt **eine** Statemachine (AGENTS.md-Invariante).
   **Kontakt-Gate:** die echten NGO-Kontaktdaten werden **erst ab `both_confirmed`**
   sichtbar (vorher anonymisiert) — Trust-Boundary/RLS, wie in AGENTS.md verankert.

3. **Teil-Deckung mit Kontingent-Abzug (D3).** Ein Bedarf (z. B. 100 Stück) darf von
   **mehreren Corporates in Teilmengen** gedeckt werden; die Restmenge wird
   heruntergezählt wie ein Warenkorb. **Jede bestätigte (Teil-)Vermittlung verbraucht
   genau eine Einheit** aus der Jahres-Quota des jeweiligen Corporate (konsistent mit
   ADR 0026). Ein Bedarf kann also mehrere Matches tragen.

4. **Abbruch — zwei Fälle trennen, faire Erstattung (D4):**
   - **Rücknahme vor Versand** (Corporate zieht vor `in_transit` zurück): gilt als Storno,
     **keine** Quota-Erstattung.
   - **Scheitern nach Versand** (`in_transit`/`delivered` misslingt): **Quota-Erstattung
     nur**, wenn das Scheitern **ohne Verschulden der NGO** eintritt. Strittige Fälle klärt
     Ops (Audit-Event pflicht).
   - Beide Fälle sind für eine saubere Erfolgs-Statistik getrennt zu erfassen
     (z. B. `cancelled` vs. `failed`).

5. **Verfall liegengebliebener Vermittlungen (D5).** Ein `proposed`-Match, das **14 Tage**
   ohne Reaktion bleibt, **verfällt automatisch**; die Quota wird dann **nicht** verbraucht.
   Vor Ablauf geht eine **Erinnerung** raus (Rücksicht auf ehrenamtliche NGOs).

6. **Umwelt-Nutzen aus gepflegter Werte-Tabelle (D6).** Der ausgewiesene Umwelt-Nutzen
   (z. B. eingespartes CO₂) kommt aus **festen, gepflegten Faktoren pro Warenkategorie** —
   **keine freie Eingabe**. Pflege liegt bei Ops. Der Spendenwert ist davon getrennt
   (→ ADR 0029).

## Konsequenzen

- **Positiv:** klarer, prüfbarer Ablauf; Privatsphäre-Schutz durch Kontakt-Gate; faire,
  nachvollziehbare Quota-/Erstattungsregeln; glaubwürdige, nicht schönrechenbare
  Impact-Zahlen; kuratierter Start hält die Qualität hoch.
- **Aufwand / Risiken:** die Kurierung (Mensch gibt frei) ist Handarbeit und wird bei
  Volumen selbst zum Engpass → Automatisierungspfad einplanen. Restmengen-Zählung ist
  fehleranfällig → Tests. „Wer ist schuld?" (D4) braucht eine Ops-Klärung + Audit.
  Werte-Tabelle (D6) muss fachlich fundiert und aktuell sein (Greenwashing-Vorwurf).
- **Abgebildet in Anforderungen:** `REQ-MATCH-01..07`, `REQ-PLAN-*` (Quota/Erstattung),
  `REQ-OPS-*` (Kurierung, Verfall-Job, Werte-Pflege) im `anforderungskatalog.md`.

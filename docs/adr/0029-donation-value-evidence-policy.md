# ADR 0029 — Bewertung des Spendenwerts (Beleg-Policy)

- **Status:** Accepted (Richtungsentscheidung) — Founder-Freigabe (Flo & Andi) am 2026-07-20
  · **offen:** finale Ausgestaltung mit Steuerberater
- **Datum:** 2026-07-20
- **Kontext-Docs:** `docs/planning/abstimmung-flo-2026-07-19-einfach.md` (Punkt E3),
  ADR 0028 (Vermittlung, Impact getrennt vom Wert), Migrationen zur
  Spendenbescheinigung/Zuwendungsbestätigung

> **Kein Ersatz für Rechts-/Steuerberatung.** Dieses ADR hält die Produkt-Richtung fest.
> Die konkrete steuerrechtliche Ausgestaltung wird mit einem Steuerberater final geklärt.

## Kontext

Der auf der Zuwendungsbestätigung ausgewiesene Spendenwert ergibt sich heute aus
**Menge × selbst angegebenem Einzelwert**. Dieser Wert ist steuerlich relevant. Nach dem
Einkommensteuergesetz haftet bei einem **überhöht bescheinigten Wert vorrangig die
ausstellende NGO** (Aussteller­haftung, spürbare Beträge). Ein bloß behaupteter,
unbelegter Wert ist rechtlich angreifbar — ein echtes Risiko für NGO, Corporate und
Plattform. In der Abstimmung vom 2026-07-20 wurde deshalb bewusst **gegen** ein rein
selbst-deklariertes Modell entschieden.

## Entscheidung

1. **Beleg-Pflicht statt Selbstauskunft (E3).** Ein Spendenwert wird **nie ungeprüft** auf
   die Zuwendungsbestätigung übernommen. Für den angesetzten Einzelwert ist ein **Nachweis
   erforderlich** (z. B. Kaufbeleg, Rechnung, Marktwert-Nachweis). Ohne hinterlegten Beleg
   keine wertbasierte Bescheinigung.

2. **Umwelt-Nutzen bleibt getrennt.** Der CO₂-/Impact-Wert (ADR 0028, D6) ist ein anderes
   Thema als der steuerliche Spendenwert und wird nicht vermischt.

3. **Steuerberater einbeziehen (offen).** Die genaue Ausgestaltung — welche Belegarten
   zulässig sind, ob eine Obergrenze/Plausibilitätsprüfung nötig ist, Formulierung der
   Haftungs-Hinweise — wird mit einem Steuerberater final festgelegt und hier nachgetragen.

## Konsequenzen

- **Positiv:** deutlich geringeres Haftungs-/Fraud-Risiko; ein sauber gelöstes
  Bewertungs-/Nachweis-Modell ist ein Vertrauens-Vorsprung im Verkauf.
- **Aufwand / Risiken:** Beleg-Upload + Prüfung erhöhen die Hürde bei der Bescheinigung und
  erzeugen Ops-Aufwand. Belegarten und Prüftiefe sind bis zur Steuerberater-Klärung offen.
- **Abgebildet in Anforderungen:** `REQ-DOC-*` (Beleg-Pflicht vor Zuwendungsbestätigung),
  `REQ-OPS-*` (Beleg-Prüfung) im `anforderungskatalog.md`.

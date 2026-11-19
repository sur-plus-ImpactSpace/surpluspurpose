# Backlog Marketing & Landingpage

Offene Punkte außerhalb der App. Neueste oben. Erledigtes mit Datum und Commit abhaken.

---

## ☑ One-Pager verschlanken & an neue LP/Pricing angleichen

Angelegt 21.09.2026 · **Erledigt 21.09.2026** (Quellen + PDFs in `04_MARKETING/`, Vorversion in
`04_MARKETING/Archive/2026-09-21_vor-Verschlankung/`). Umgesetzt: KI-Starthilfe und „Geldspenden
bleiben frei" raus, NGO-Namen raus, eine Zahl (50), Top-Bedarfe statt Namensliste, Corporate:
Pricing/Seed-Leistungen, Transport ohne Festpreis, keine englischen Sätze, Regulierung nach
Omnibus I (CSRD 1.000 MA/450 Mio., CSDDD ab 26.07.2029) plus EmpCo, ein CTA. Offen: Corporate-
One-Pager EN (gibt es noch nicht) und neue Fit-Parameter im Registrierungs-Skill.

Ursprüngliche Aufgabe:

**Ziel:** Die drei One-Pager so kürzen und schärfen wie die Startseite
(Corporate-first-Prototyp vom 21.09.2026): jede Aussage einmal, echte Zahlen statt
Behauptungen, ein Primär-CTA, Pricing wie auf der Website.

**Dateien** (gitignored, nur auf der Platte):
`04_MARKETING/surplus_NGO_Onepager_DE_source.html`, `_EN_source.html`,
`surplus_Corporate_Onepager_DE_source.html` — PDFs danach neu bauen
(Parameter: Skill `surplus-registrierungen-taeglich`, Schritt 6).

### NGO-One-Pager (DE + EN, ~600 → ~450 Wörter)

- [ ] **„Kostenlose KI-Starthilfe" / „Free AI starter help" entfernen** (Benefit-Kachel)
- [ ] Benefits von 8 auf 5–6 Kacheln: „Geldspenden bleiben frei" doppelt die Headline
      „Ressourcen ohne Fundraising"; „Verifizierter Status" prüfen
- [ ] Dopplungen raus, je einmal: 49 NGOs (Stat-Kachel + Proof-Zeile), Impact Pledge
      (Stat-Kachel + Transparenz-Block), < 72 h (Stat + Schritt 02)
- [ ] **Nur eine Zahl: 49 NGOs** (Entscheidung 21.09.) — keine separate Bedarfe-Zahl;
      stattdessen ggf. die Top-Bedarfe wie auf der LP („Was heute gebraucht wird")
- [ ] **NGO-Namen entfernen** (Proof-Zeile „u. a.: Labdoo · Space-Eye · …")

### Corporate-One-Pager (DE, ~600 → ~450 Wörter)

- [ ] **Pricing an neue Seed/Tree-Struktur angleichen** (Commit `af27e09`):
      ESPR-Nachweispaket, Logistikpartner, koordinierte Abholung,
      Service-Partner-Netzwerk, Newsletter, Marketing-Dashboard jetzt in **Seed**
- [ ] Transport-Kachel: „Koordination auf Wunsch zum Festpreis je Abholung" →
      „Koordinierte Abholung · Transport zum Selbstkostenpreis" (kein 390-€-Preis)
- [ ] „49 verifizierte NGO-Partner **mit konkreten Bedarfen**" → nur „49 verifizierte NGOs"
      (3 haben keinen Bedarf gemeldet)
- [ ] Englische Sätze im DE-Dokument ersetzen („Every surplus has a purpose.",
      „Goodwill was never the problem…")
- [ ] Dopplung Lager-/Entsorgungskosten (Intro + Benefit-Kachel) auflösen
- [ ] Claims prüfen: „100 % audit-ready" und „bis 20 % des Jahresgewinns absetzbar"
      als Stat-Kacheln — belastbar formulieren oder in den Fließtext
- [ ] Drei CTAs (Impact-Session, Onboarding, Pulse) → ein Primär-CTA
      **„Onboarding anfragen"**, wie auf der LP
- [ ] Offene Frage an Flo: Braucht es einen **Corporate-One-Pager EN**? Gibt es bisher nicht.

### Abnahme

- [ ] Je genau eine Seite; Layout-Referenzwerte aus dem Skill eingehalten
      (unterste Zeile 834,2 pt NGO DE / 797,0 pt Corporate DE)
- [ ] QR-Codes und CTA-Links sprachgetrennt (DE → `jaKQxY` / `dW7PQd`)
- [ ] Quell-HTML **und** PDF auf die Platte zurückschreiben, nicht nur die PDFs

**Abhängigkeit:** Endgültige Formulierungen (Hero, CTA-Labels) erst festziehen, wenn
der Corporate-first-Prototyp der Startseite entschieden ist.

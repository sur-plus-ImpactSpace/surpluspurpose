# ADR 0027 — Registrierungs- & Verifizierungs-Policy

- **Status:** Accepted — Founder-Freigabe (Flo & Andi) am 2026-07-20
- **Datum:** 2026-07-19 · **Angenommen:** 2026-07-20
- **Kontext-Docs:** `auth-access-roadmap.md`, `AGENTS.md` (Trust-Boundary), Migrationen
  0013 (NGO-Verifizierung), 0019 (claim_workspace), 0014–0016 (registered-Gating)

## Kontext

Heute (`claim_workspace`, Migration 0019) provisioniert sich ein Nutzer nach der
E-Mail-Bestätigung selbst: `requested_role` aus den Signup-Metadaten entscheidet
zwischen `corporate` (→ `companies`, Plan `registered`) und `ngo` (→ `ngos`,
`verification_state='onboarding'`). Admin wird nie self-service provisioniert.

Daraus folgt eine **Asymmetrie**:

- **NGOs** durchlaufen eine echte Verifizierungs-Pipeline
  (`onboarding → verification_pending → pending_info → review → verified/rejected`,
  Ops-RPC `set_ngo_verification`, Migration 0013).
- **Corporates** durchlaufen **keine Identitätsprüfung** — wer sich mit
  `requested_role=corporate` anmeldet und die E-Mail bestätigt, ist sofort eine
  „registered"-Firma mit Katalog-Zugriff. Es gibt keinen Nachweis, dass ein echtes
  Unternehmen dahintersteht.

Das steht im Widerspruch zum Moat der Plattform: **Vertrauen + Compliance**
(Spendenbescheinigung, CSRD). Ein gefälschtes Konto auf *beiden* Seiten ist ein
Steuer-/Fraud-Risiko.

## Entscheidung

1. **Nur zwei legitime Kontotypen** können sich registrieren: **Corporate** und **NGO**.
   Admin nie self-service (bleibt). Privatpersonen/Freemail werden abgelehnt.

2. **Registrierung = Antrag, nicht Zugang.** Echte Fähigkeiten (Listing anlegen,
   matchen, NGO-Kontakt sehen, Dokumente) werden erst nach **bestandener Verifizierung**
   freigeschaltet — nicht bereits durch die Anmeldung. `registered` darf browsen
   (anonymisierter Katalog), mehr nicht.

3. **Hybride Prüfung — automatisch, wo sicher; manuell, wo es zählt.** Das Prüf-Niveau
   ist risiko-proportional und pro Rolle unterschiedlich:

   **Corporate (zahlende Seite, geringeres Fraud-Risiko) — leicht, stark automatisiert:**
   - Auto: keine Freemail (gmail/gmx/web.de → ablehnen), Firmen-Domain der E-Mail
   - Auto: **USt-IdNr. via EU-VIES** (kostenlos), registrierten Namen gegen Antrag abgleichen
   - Auto: Website-/Domain-Existenz
   - Bei „alles grün" → automatische Freigabe; sonst → manuelle Ops-Sichtung

   **NGO (trust-kritisch: bestätigt Wareneingang, löst Spendenbescheinigung aus) —
   automatik-gestützt, aber menschliche Endfreigabe Pflicht:**
   - Auto: Double-Opt-In, Registernummer-Format, wo möglich API-Lookup
     (UK Charity Commission, US 501(c)(3))
   - Auto: Pflicht-Upload Gemeinnützigkeitsnachweis (DE: Freistellungsbescheid) — Vorhandensein
   - **Manuell (Pflicht):** Ops prüft Träger-Echtheit + Dokument → verified/rejected.
     **Nie voll-automatisch.**

4. **Neue Corporate-Verifizierungs-Pipeline** analog zur NGO (State-Feld +
   `set_company_verification`-RPC + gemeinsame Ops-Queue). Beseitigt die Asymmetrie.

5. **Capability-Gating an Verifizierung koppeln**, nicht nur an Bezahlung.

## Founder-Entscheidungen (2026-07-20, zuvor offen)

Die drei zuvor offenen Punkte sind in der Abstimmung vom 2026-07-20 entschieden
(`docs/planning/abstimmung-flo-2026-07-19-einfach.md`, Punkte C3–C5):

- **Corporate-Strenge (C3):** **Automatische Freigabe, wenn alles grün ist**
  (gültige USt-IdNr. via VIES, Firmen-Domain, keine Freemail); jeder Zweifelsfall geht in
  die manuelle Ops-Sichtung. Keine manuelle Pflicht-Sichtung im Normalfall.
- **Freemail-Politik & Pflichtfelder (C4):** **Corporate:** kostenlose Freemail-Adressen
  (gmail/gmx/web.de u. ä.) werden **abgelehnt** — Firmen-Domain Pflicht. **NGO:** Freemail
  **erlaubt** (viele kleine Vereine nutzen sie), dafür ist der **Upload eines
  Gemeinnützigkeits-/Nachweis-Dokuments Pflicht**.
- **Step-up-Faktor bei kritischer Aktion (C5):** Zum Start die **erneute Bestätigung per
  E-Mail** (E-Mail-Reauth) für heikle Aktionen (v. a. NGO bestätigt Wareneingang → löst
  Spendenbescheinigung aus). TOTP-App-Faktor bleibt als spätere Option.

> Verwandte, in derselben Sitzung getroffene Entscheidung außerhalb dieses ADR:
> die steuerliche Bewertung des Spendenwerts (E3) → eigenes **ADR 0029** (Beleg-Pflicht).

## Konsequenzen

- **Positiv:** symmetrische Vertrauensbasis, geringeres Fraud-Risiko, klare Trennung
  „browsen vs. handeln", automatisierte Prüfung hält Ops-Aufwand niedrig.
- **Aufwand:** neue Corporate-Verifizierung (Schema + RPC + UI), VIES-Integration,
  Double-Opt-In, Registry-Lookups. Externe Abhängigkeiten (VIES, Charity-APIs).
- **Abgebildet in Anforderungen:** `REQ-AUTH-01..05`, `REQ-OPS-01..05` im
  `anforderungskatalog.md`.

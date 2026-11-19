# Auth- & Zugangs-Roadmap

Stand: 2026-07-11 · Status: **Entscheidung festgehalten, Umsetzung gestaffelt**

Legt fest, wie sich Nutzer bei sur.plus anmelden und registrieren.

> ## ⚠️ Revision 2026-07-11 — „Smart Simplicity", identisch für beide Rollen
>
> **Kurskorrektur (Flo):** Kein segment-adaptiver Auth-Split mehr. Corporate und
> NGO bekommen den **identischen**, bewusst einfachen Login-Satz („Smart
> Simplicity"):
>
> 1. **Google / OAuth** (ein Klick)
> 2. **E-Mail + Passwort + 2FA**
> 3. **Magic-Link als Fallback**
>
> Ein Flow für alle — minimale Reibung, keine Rollen-Sonderwege. Der frühere
> segment-adaptive Teil unten (Corporate = OAuth, NGO = Phone/WhatsApp-OTP) ist
> damit **überholt**; Phone-/WhatsApp-OTP wandern in eine spätere, optionale
> Ausbaustufe (nicht Teil des Kern-Login). Das **Gate** (invite/verification) und
> die getrennten Schichten (Auth / Provisioning / Funnel) bleiben unverändert.

---

## Leitprinzipien

1. **Gate bleibt — mit sichtbarer Vordertür.** Kein offener Self-Signup. Provisioning
   (Workspace + Rolle) läuft über Einladung/Verifizierung. Aber „invite-only" heißt
   *gated onboarding mit Bewerbung*, nicht „keine Tür". Grund: der Moat ist Vertrauen +
   Compliance (Spendenbescheinigung, CSRD). Ein gefälschter NGO-Account = Steuer-/
   Fraud-Risiko für uns und die zahlenden Corporates.

2. **Drei getrennte Schichten.**
   - *Authentifizierung* — wer bist du (Magic-Link / OAuth / OTP / Passkey).
   - *Provisioning/Autorisierung* — bekommst du einen Workspace, welche Rolle → **das Gate**.
   - *Inbound-Funnel* — wie meldet Interesse sich → Registrierung/Bewerbung.

3. **Segment-adaptive Auth.** Nicht ein Verfahren für alle. Corporate ≠ NGO.

4. **Step-up statt Dauer-2FA.** Niedrigschwelliger Login + eine zusätzliche Bestätigung
   **nur im Moment der folgenreichen Aktion** (NGO bestätigt Wareneingang / schaltet
   Zertifikat frei). Löst „zugänglich *und* sicher" ohne jeden Login zu belasten.

---

## Corporate

EU-Firmen, meist M365 / Google Workspace, IT-Abteilung.

- **OAuth Microsoft + Google** (Primär) + **Magic-Link** (Fallback).
- **SSO / SAML** später, deal-getrieben (größere Logos verlangen „SSO-only"). Supabase
  kann SAML, meist erst höherer Tier.
- Passwort: nicht nötig.

## NGO (v. a. international)

International heißt: unzuverlässige E-Mail-Zustellung, geteilte Org-Accounts, oft **kein**
Google Workspace — aber fast immer ein **Telefon**, und in weiten Teilen der Welt ist
**WhatsApp** der De-facto-Kanal, nicht E-Mail.

- **Phone-OTP (SMS)** als gleichwertige Primär-Option **neben** E-Mail-OTP/Magic-Link.
- **WhatsApp-OTP** — starker Differenzierer für internationale Reichweite; wir haben schon
  WhatsApp-Business-Präsenz. Via Twilio/Supabase machbar, kostet pro Nachricht + Meta-Setup.
  **Spätere, volumengetriebene Ausbaustufe.**
- **Passwort**: **nicht** als Hauptweg — geteilte Accounts + schwache Passwörter + kein
  IT-Support = schwächstes Glied. Phone-OTP deckt „E-Mail unzuverlässig" besser ab. Nur
  echter Offline-Fallback, wenn nötig.
- **Authenticator-App (TOTP)**: kostenlos, phishing-resistent, aber Einrichtungsreibung →
  **optionale** 2FA, keine Pflicht.

---

## Registrierung (ersetzt Tally)

Tally auf der LP ist ein **Stopgap**, bis die Registrierung nativ im Produkt ist. Nativ =
wir kontrollieren Daten, Verifizierungs-Workflow und Funnel.

**Corporate:** „Zugang anfragen" → Lead-Capture (Firmendaten + Kontakt) → Sales/Calendly.

**NGO — Bewerbung mit Echtheitsdaten-Intake + Double-Opt-In:**

1. Antragsformular erfasst **Echtheitsdaten** (Pflicht/optional je nach Land):
   - Rechtsträger (offizieller Name) · Rechtsform (e.V. / gGmbH / Stiftung / int. Äquivalent)
   - Registernummer (Vereinsregister-VR / int. Register) · registrierte Adresse
   - Gemeinnützigkeit / Steuerbefreiung: Nachweis (DE: Freistellungsbescheid; US: 501(c)(3);
     UK: Charity-Nr.; …) — als **Dokument-Upload**
   - Vertretungsberechtigte(r) / Vorstand + Rolle · Kontakt-E-Mail + Telefon
   - Fokus / Zielgruppe / Beneficiaries
   Mappt auf die bestehende `ngos`-Tabelle (`verification_state`, `trust_score`,
   `board_contact`, `address`, `contact_*`) + Verifizierungs-Dokument.
2. **E-Mail-Bestätigung (Double-Opt-In)** — Antrag zählt erst nach bestätigter E-Mail
   (verhindert Spam-/Fake-Anträge).
3. Antrag landet in der **Ops-Verifizierungs-Queue** (existiert bereits) → Ops prüft →
   Einladung wird ausgelöst → NGO meldet sich per gewähltem Verfahren an.

Damit ist Registrierung + Verifizierung ein durchgängiger, kontrollierter Fluss statt
eines externen Formulars.

---

## Sicherheit & Compliance

NGO-Accounts sind **trust-kritisch**: sie bestätigen Wareneingang und schalten die
Spendenbescheinigung frei. Ein gekaperter NGO-Account könnte falsch bestätigen. Deshalb:
**Step-up-Auth** genau an diesen Aktionen, nicht bei jedem Login. Und: die **Verifizierung
des Trägers** (Echtheitsdaten, Freistellungsbescheid) wiegt schwerer als die individuelle
Login-Methode.

## Session

Magic-Link-Sessions liefen nach ~1 h aus (siehe M1). Refresh-Token / Cookie-Persistenz
härten, sonst fliegen Nutzer mitten in der Arbeit raus. Prüfen vor jedem UI-Walk.

---

## Kosten-Gradient & Phasing

E-Mail-OTP (quasi gratis) → TOTP (gratis, Reibung) → SMS (kostet pro Nachricht, Provider
nötig) → WhatsApp (kostet + Meta-Setup). Architektur **jetzt OTP-fähig** bauen (E-Mail +
Phone), teure Kanäle später zuschalten.

- **Phase 1 (jetzt, prod-safe):** native Registrierung + E-Mail-Bestätigung + NGO-
  Echtheitsdaten-Intake · Corporate-OAuth (MS+Google) + Magic-Link · Session-Persistenz-Fix.
- **Phase 2:** NGO Phone-OTP · Step-up-Auth bei kritischer Aktion.
- **Phase 3 (bedarfsgetrieben):** WhatsApp-OTP · optionale TOTP-2FA · Enterprise-SSO/SAML.

## Supabase-Machbarkeit

Grundsätzlich alles mit Supabase Auth: OAuth-Provider, E-Mail-/Phone-OTP, MFA (TOTP),
SAML (höherer Tier). SMS/WhatsApp über Provider (Twilio o. ä.), kostenpflichtig. **Genaue
Tier-/Feature-Verfügbarkeit vor Umsetzung jeweils prüfen** (kann sich ändern).

## Offene Entscheidungen

- SMS-/WhatsApp-Provider (Twilio vs. MessageBird vs. …).
- NGO-Echtheitsdaten: welche Felder Pflicht vs. optional, DE vs. international.
- Step-up-Faktor bei der kritischen Aktion (E-Mail-Reauth vs. OTP vs. TOTP).

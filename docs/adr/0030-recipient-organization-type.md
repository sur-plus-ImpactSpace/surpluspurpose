# ADR 0030 — Empfänger-Organisationstyp & typabhängiger Nachweis

- **Status:** Proposed — **Gründer-Call (Andi + Florian) + steuerliche Prüfung ausstehend.**
  Dieser ADR ist Diskussionsgrundlage, keine Festlegung. Die Typ-Liste und die
  rechtliche Bewertung (wer darf Zuwendungsbestätigungen ausstellen) müssen mit
  einem Steuerberater bestätigt werden (siehe auch [ADR 0029](0029-donation-value-evidence-policy.md)).
- **Datum:** 2026-07-31
- **Bezug:** [ADR 0027](0027-registration-verification-policy.md) (Verifizierungs-Policy,
  C4 Nachweis-Pflicht) · REQ-NGO-01/02 im Anforderungskatalog · Migration 0022
  (`claim_workspace`, Personenfelder) · geplante Migration 0023.

## Kontext

Bisher kennt die Plattform auf der Empfänger-Seite **eine** Rolle: `ngo`. Die
Verifizierung ist implizit auf den Fall „steuerbegünstigter Verein mit
**Freistellungsbescheid**" zugeschnitten (`ngos.tax_authorization_ref`,
`NgoAuthorizationForm`).

Wir wollen die Empfänger-Seite bewusst breiter öffnen: **gemeinnützige GmbHs
(gGmbH), Stiftungen, Kitas, Schulen, Gemeinden/Kommunen** und Einrichtungen in
freier Trägerschaft. Diese Typen sind **rechtlich unterschiedlich** empfangs-
berechtigt und haben **unterschiedliche Nachweise**:

- **Steuerbegünstigte Körperschaften** (e.V., gGmbH/gUG, Stiftung) weisen ihre
  Gemeinnützigkeit über den **Freistellungsbescheid** (bzw. Anlage zum
  Körperschaftsteuerbescheid) nach.
- **Juristische Personen des öffentlichen Rechts (jPöR)** — öffentliche Schulen,
  öffentliche Kitas, Gemeinden, Universitäten — dürfen Zuwendungsbestätigungen
  **kraft ihres öffentlich-rechtlichen Status** ausstellen und haben **keinen**
  Freistellungsbescheid.
- **Einrichtungen in freier/kirchlicher Trägerschaft** (Kita/Schule eines Vereins
  oder der Kirche) sind über ihren **Träger** empfangsberechtigt.

Ein einheitliches „Lade deinen Freistellungsbescheid hoch" wäre für Schulen,
Kitas und Gemeinden schlicht falsch.

## Entscheidung (Vorschlag)

1. **Keine neue Rolle.** Die Rolle bleibt binär: `corporate` (Geber) ↔ `ngo`
   (Empfänger). Das hält die eine Match-Statemachine und die Corporate/NGO-
   Terminologie aus `AGENTS.md` intakt. Der Empfänger bekommt stattdessen einen
   **Organisationstyp** als Klassifizierung.

2. **Neues Pflichtfeld `org_type` bei der Registrierung** (nur im NGO-Zweig).
   Es steuert, **welcher Nachweis** in der Verifizierung verlangt wird. Technisch
   analog zu den Personenfeldern (0022): Auswahl im Signup → Signup-Metadaten →
   `claim_workspace` validiert + persistiert → `ngos.org_type`.

3. **Typ → Nachweis-Matrix** (Diskussionsstand, steuerlich zu bestätigen):

   | `org_type`      | Typ (Anzeige)                         | Beispiele                                  | Nachweis in der Verifizierung                                   |
   |-----------------|----------------------------------------|--------------------------------------------|-----------------------------------------------------------------|
   | `verein`        | Gemeinnütziger Verein (e.V.)           | Hilfswerk, Sozialverein                    | Freistellungsbescheid + Vereinsregister-Nr.                     |
   | `ggmbh`         | Gemeinnützige GmbH / UG (gGmbH/gUG)    | Träger-gGmbH                               | Freistellungsbescheid + Handelsregister-Nr.                     |
   | `stiftung`      | Gemeinnützige Stiftung                 | Stiftung                                   | Freistellungsbescheid / Anerkennung                             |
   | `public_body`   | Öffentliche Einrichtung (jPöR)         | öffentliche Schule/Kita, Gemeinde, Uni     | **kein** Freistellungsbescheid — Nachweis öffentl. Trägerschaft |
   | `freier_traeger`| Einrichtung in freier/kirchl. Trägerschaft | Kita/Schule eines Vereins oder der Kirche | Nachweis des Trägers (dessen Freistellungsbescheid) + Zugehörigkeit |

4. **Verifizierung wird typabhängig** (REQ-NGO-02): Der Pflicht-Upload und die
   `NgoAuthorizationForm`-Felder werden je nach `org_type` konditional. Eine jPöR
   sieht das Freistellungsbescheid-Feld gar nicht, sondern einen Feld-/Upload-Satz
   für den öffentlich-rechtlichen Nachweis. **Ops-Freigabe bleibt manuell** und nie
   voll-automatisch (ADR 0027 C4).

5. **`org_type` ist nullable** in der DB — Bestandsdaten und der Einladungspfad
   (`accept_invitation`) bleiben gültig. Für neue Selbstregistrierungen ist die
   Auswahl in Formular **und** RPC Pflicht (RPC nicht schwächer als UI).

## Offen / bewusst nicht entschieden

- **Genaue Typ-Liste**: Sind weitere Typen nötig (z. B. Sozialunternehmen **ohne**
  Gemeinnützigkeit, Genossenschaften)? Diese wären ggf. **nicht** spendenempfangs-
  berechtigt → eigene Behandlung. → Gründer + Steuerberater.
- **Rechtliche Empfangsberechtigung** pro Typ für das Spendenwert-/
  Bescheinigungsmodell (ADR 0029). → Steuerberater.
- **Wording nach außen**: „NGO" passt als Label für Schule/Gemeinde nicht mehr.
  Die Empfänger-Seite müsste auf der Landingpage (Single Source of Truth) breiter
  heißen (z. B. „gemeinnützige & öffentliche Empfänger"). → Gründer.

## Konsequenzen

- Registrierung erfasst den Organisationstyp früh und maschinenlesbar → Ops kann
  den richtigen Nachweis anfordern, statt pauschal Freistellungsbescheid.
- Verifizierungs-Fluss (REQ-NGO-02) und `NgoAuthorizationForm` werden je Typ
  verzweigt (Folge-Arbeit).
- Der breitere Empfänger-Kreis ist ein Produkt-/Marktschritt, der auf der
  Landingpage und in den Rechtstexten nachgezogen werden muss.

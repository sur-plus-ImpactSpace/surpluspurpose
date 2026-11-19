# Abstimmung mit Flo — Entscheidungs-Checkliste

Stand: 2026-07-19 · Teilnehmer: Flo (Founder/Owner), Andi (Dev) · Moderation: live durchgehen

> **Zweck.** Alle offenen Entscheidungen, die Founder-Freigabe brauchen, an einem Ort.
> Wir gehen sie der Reihe nach durch, tragen den **Beschluss** direkt ein, und danach
> setze ich sie in Katalog (`anforderungskatalog.md`), ADRs und Repo-Config um.
>
> Reihenfolge: **A** Repo-Aufräumen (schnell) → **B** Katalog-Format (meta) →
> **C** Registrierung/Verifizierung (Policy) → **D** MATCH-Prozess (M1–M6) →
> **E** Produkt- & Rechts-Grundsätze → **F** App-Redesign/UI.

---

## Teil A — Repo & Governance *(schnell, „aufräumen")*

### A1 — Branch-Cleanup freigeben
- **Kontext:** ~37 bereits gemergte Alt-Branches (`codex/*`, `feat/*`) + `staging` (69 commits behind) liegen tot im Remote.
- **Frage:** Dürfen wir die gemergten Branches + `staging` löschen?
- **Empfehlung:** Ja — nur gemergte Branches löschen, `staging` weg (ersetzt durch `develop`).
- ✅ **Chancen:** übersichtliches Remote, keine Verwechslung, schnellere Orientierung.
- ⚠️ **Risiken:** versehentlich einen noch nicht gemergten Branch löschen → vorher `git branch --merged` prüfen.
- 🔍 **Praxis:** Standard-Git-Hygiene; GitHub-Option „Automatically delete head branches" nach Merge.
- **Beschluss:** ________________________

### A2 — Dependabot-Branches (4 offen)
- **Kontext:** 4 offene Dependabot-PRs/Branches.
- **Frage:** Einzeln mergen (nach grünem CI) oder pauschal schließen?
- **Empfehlung:** Einzeln via PR mergen, wo CI grün; sonst schließen.
- ✅ **Chancen:** Sicherheits-/Bugfix-Updates kommen rein, kleinere Angriffsfläche.
- ⚠️ **Risiken:** Major-Version-Bump kann Breaking Change sein → nicht blind mergen.
- 🔍 **Praxis:** üblich ist Patch/Minor bei grünem CI auto-mergen, Major manuell prüfen.
- **Beschluss:** ________________________

### A3 — Branch Protection (main + develop)
- **Kontext:** Aktuell kein Schutz. Ziel: nichts geht ungeprüft nach main/develop.
- **Frage:** Regeln aktivieren? (PR-Pflicht, grüne Checks, kein force-push, ggf. 1 Review)
- **Empfehlung:** main = streng (PR + grüne Checks + Review), develop = PR + grüne Checks.
- ✅ **Chancen:** kein versehentliches Kaputt-Pushen auf Prod, erzwungenes Vier-Augen-Prinzip.
- ⚠️ **Risiken:** minimale Reibung (auch Kleinkram braucht PR) — bei 2 Personen verschmerzbar.
- 🔍 **Praxis:** GitHub „Protected branches" mit Required Status Checks ist Industriestandard.
- **Beschluss:** ________________________

### A4 — Netlify Branch-Deploy für `develop` (Staging)
- **Kontext:** develop soll auf eigenes Staging-Supabase + eigene Preview-URL deployen.
- **Frage:** Branch-Deploy für develop einrichten?
- **Empfehlung:** Ja — trennt Prod-Daten sauber, gibt Deploy-Previews vor main.
- ✅ **Chancen:** Prod-Daten sicher getrennt, echte Vorschau vor Go-live, einfacher Rollback.
- ⚠️ **Risiken:** zweite Supabase-Instanz = etwas Pflege/Kosten, Schema muss synchron bleiben.
- 🔍 **Praxis:** „Staging/Preview-Environment" ist Standard (Netlify Deploy Previews, Vercel Preview Deployments).
- **Beschluss:** ________________________

### A5 — CODEOWNERS + PR-Template
- **Kontext:** Kein Review-Owner, kein PR-Gerüst definiert.
- **Frage:** CODEOWNERS (Flo als Default-Reviewer?) + PR-Template einführen?
- **Empfehlung:** Ja, kleiner Branch `feature/repo-governance`.
- ✅ **Chancen:** klare Review-Verantwortung, konsistente PR-Beschreibungen.
- ⚠️ **Risiken:** Overhead für ein 2-Personen-Team — bewusst schlank halten.
- 🔍 **Praxis:** GitHub CODEOWNERS + PR-Template sind Standard in Team-Repos.
- **Beschluss:** ________________________

---

## Teil B — Anforderungskatalog: Format *(meta, schnell)*

*Bezug: offene Format-Entscheidungen unten im `anforderungskatalog.md`. Betrifft nur die Form, nicht den Inhalt.*

### B1 — Granularität
- **Frage:** Viele kleine REQ (feingranular) oder ein REQ pro Feature (grob)?
- **Empfehlung:** Feingranular für MATCH/AUTH (prüfbar), gröber bei NFR.
- ✅ **Chancen:** kleine REQ sind einzeln testbar und 1:1 einem PR zuordenbar.
- ⚠️ **Risiken:** zu fein = Pflege-Overhead, Katalog wird unübersichtlich.
- 🔍 **Praxis:** gängig ist „eine Anforderung = eine Story = ein PR" (User-Story-Granularität).
- **Beschluss:** ________________________

### B2 — Akzeptanzkriterien-Format
- **Frage:** Freitext-Checklisten oder Gherkin (Given/When/Then)?
- **Empfehlung:** Freitext-Checklisten (leichter zu pflegen, reicht für uns zwei).
- ✅ **Chancen:** Freitext ist schnell; Gherkin wäre später direkt in automatisierte Tests überführbar.
- ⚠️ **Risiken:** Gherkin ohne Test-Automatisierung = unnötige Bürokratie.
- 🔍 **Praxis:** Gherkin lohnt erst mit BDD-Test-Tooling (Cucumber o. ä.); sonst Freitext-Checklisten.
- **Beschluss:** ________________________

### B3 — Priorisierung
- **Frage:** MoSCoW (Must/Should/Could/Won't) oder Prio 1–3?
- **Empfehlung:** MoSCoW.
- ✅ **Chancen:** MoSCoW trennt „Launch-blockierend" klar von „nice to have".
- ⚠️ **Risiken:** ohne Disziplin wird alles „Must" → Priorisierung entwertet.
- 🔍 **Praxis:** MoSCoW ist der De-facto-Standard für Scope-Priorisierung (DSDM/Agile).
- **Beschluss:** ________________________

### B4 — Verknüpfung ADR ↔ REQ
- **Frage:** Reicht das `Bezug`-Feld im REQ, oder Rückverweise auch in den ADRs?
- **Empfehlung:** `Bezug`-Feld reicht; ADR verlinkt nur die betroffenen REQ-IDs am Ende.
- ✅ **Chancen:** eine Richtung pflegen ist wartbar; ADR bleibt „warum", REQ bleibt „was".
- ⚠️ **Risiken:** beidseitige Links driften auseinander, wenn man einen vergisst.
- 🔍 **Praxis:** ADRs (Michael Nygard-Format) verweisen üblich nur lose; Traceability-Matrix erst bei Audit-Pflicht.
- **Beschluss:** ________________________

### B5 — Pflege-Struktur
- **Frage:** Katalog als Single-File oder pro Bereich eine Datei bei Wachstum?
- **Empfehlung:** Single-File jetzt, Split erst wenn > ~40 REQ.
- ✅ **Chancen:** Single-File ist durchsuchbar (Ctrl-F) und diff-freundlich.
- ⚠️ **Risiken:** ab ~einigen hundert Zeilen unübersichtlich, Merge-Konflikte häufiger.
- 🔍 **Praxis:** viele Teams starten Single-File und splitten pro Domäne erst bei echtem Wachstum.
- **Beschluss:** ________________________

---

## Teil C — Registrierung & Verifizierung *(ADR 0027, Policy)*

*Bezug: `docs/adr/0027-registration-verification-policy.md` (Status: Proposed). Kernproblem: NGOs werden verifiziert, Corporates heute **gar nicht** → Asymmetrie & Fraud-Risiko.*

> **Belegte Werkzeuge für DE (aus Recherche):** **EU VIES** (`ec.europa.eu`) = kostenlose,
> automatische USt-IdNr.-Prüfung. **Zuwendungsempfängerregister / BZSt** (`zer.bzst.de`, live
> seit Feb 2024, §60b AO) = das **maßgebliche** DE-Register aller steuerbegünstigten Orgs, die
> Zuwendungsbestätigungen ausstellen dürfen — der eigentliche Gemeinnützigkeits-Nachweis.
> Ein offizielles öffentliches **Handelsregister-API gibt es in DE nicht** (nur Reseller wie
> handelsregister.ai/OpenRegister).

### C1 — Grundsatz: symmetrische Verifizierung
- **Frage:** Bekommen **Corporates** eine eigene Verifizierungs-Pipeline (analog NGO)?
- **Empfehlung:** Ja — beseitigt die Asymmetrie, schützt Compliance-Moat.
- ✅ **Chancen:** beidseitige Vertrauensbasis, geringeres Fraud-Risiko, stärkeres Compliance-Argument im Sales.
- ⚠️ **Risiken:** Aufwand (Schema + RPC + UI); zusätzliche Reibung im Corporate-Signup könnte Conversion senken.
- 🔍 **Wie andere es lösen:** Compliance-lastige B2B-Plattformen gaten Signup grundsätzlich hinter Business-Verifizierung — **Mercury, Brex, Ramp** verifizieren jedes Unternehmen vor Kontoeröffnung (1–2 Werktage).
- **Beschluss:** ________________________

### C2 — „Registrierung = Antrag, nicht Zugang"
- **Frage:** Schaltet Anmeldung nur Browsen (anonym. Katalog) frei, echte Aktionen erst nach Verifizierung?
- **Empfehlung:** Ja.
- ✅ **Chancen:** „browsen vs. handeln" sauber getrennt; unverifizierte Konten können keinen Schaden anrichten.
- ⚠️ **Risiken:** verzögerte Gratifikation — manche Interessenten springen vor Abschluss der Verifizierung ab.
- 🔍 **Wie andere es lösen:** **Vanta, Drata** geben sensible Inhalte erst nach Verifizierung des Anfragenden frei (Trust-Center-Gating); **Mercury** schaltet Funktionen erst nach bestandenem KYB frei.
- **Beschluss:** ________________________

### C3 — Corporate-Strenge (der eigentliche Founder-Call)
- **Frage:** Bei grüner EU-VIES-USt-IdNr.-Prüfung **voll-automatisch** freigeben, oder **immer** manuelle Ops-Sichtung?
- **Empfehlung:** Auto bei „alles grün" (VIES + Domain + keine Freemail), sonst manuell.
- ✅ **Chancen:** Standardfall skaliert ohne Ops-Aufwand, Freischaltung in Minuten statt Tagen.
- ⚠️ **Risiken:** VIES bestätigt nur, dass die USt-IdNr. gültig ist — **nicht**, dass der Antragsteller wirklich zu der Firma gehört. Auto kann Identitäts-Grenzfälle durchlassen.
- 🔍 **Wie andere es lösen:** **Goodstack (ehem. Percent)** prüft API-first automatisch (offizielle Register + Sanktions-/Adverse-Media-Screening + **E-Mail-Domain-Matching**) und eskaliert **nur bei Mismatch** auf manuell — genau das empfohlene Hybrid-Muster.
- **Beschluss:** ________________________

### C4 — Freemail-Politik & Pflichtfelder
- **Frage:** Freemail (gmail/gmx/web.de) grundsätzlich ablehnen? Pflichtfelder DE vs. international?
- **Empfehlung:** Corporate: Freemail ablehnen. NGO: Freemail tolerieren (viele kleine Vereine), dafür Dok-Upload Pflicht.
- ✅ **Chancen:** Freemail-Ablehnung bei Corporate filtert Fake-Konten billig; Firmen-Domain ist ein schwacher, aber gratis Identitätsanker.
- ⚠️ **Risiken:** viele echte kleine NGOs/Vereine nutzen gmx/web.de — pauschale Ablehnung würde legitime Träger aussperren.
- 🔍 **Wie andere es lösen:** KYB-Flows koppeln die E-Mail-Domain ans Firmenregister (Goodstack: „E-Mail-Domain-Matching"); die NGO-Seite verlässt sich stattdessen auf **Register + Dokument** (BZSt-Register / Freistellungsbescheid), nicht auf die E-Mail-Domain.
- **Beschluss:** ________________________

### C5 — Step-up bei kritischer Aktion
- **Frage:** Zweiter Faktor bei kritischen Aktionen — E-Mail-Reauth, OTP oder TOTP?
- **Empfehlung:** E-Mail-Reauth zum Start (niedrigste Reibung), TOTP später als Option.
- ✅ **Chancen:** schützt die steuerrelevante Aktion (Wareneingang bestätigen → löst Spendenbescheinigung aus) vor Konto-Missbrauch.
- ⚠️ **Risiken:** TOTP-Zwang = Reibung + Support-Last (verlorene Geräte); zu viel Sicherheit bremst Nutzung.
- 🔍 **Wie andere es lösen:** gestuftes Muster wie bei Banking-Apps — Reauth/OTP für die meisten Aktionen, TOTP optional/verpflichtend nur für kritische Rollen (Step-up bei der riskanten Transaktion, nicht überall).
- **Beschluss:** ________________________

---

## Teil D — MATCH-Prozess (M1–M6) *(Prozess 1/9 des Brainstorms)*

*Ergebnis wird zu `REQ-MATCH-01..06` + ADR 0028.*

> **Wichtigste Recherche-Erkenntnis für diesen Block:** Fast alle etablierten Sachspenden-
> Plattformen matchen **NICHT algorithmisch**, sondern per **Katalog (browse-and-request) +
> kuratiertem Team-Intake**. Echtes zweiseitiges Algorithmus-Matching ist die Ausnahme
> (nur Too Good To Go). Das stützt einen kuratierten, nicht voll-automatischen Start.

### M1 — Wie entsteht ein Match?
- **Optionen:** (a) rein automatisch · (b) hybrid: Engine schlägt vor, Ops gibt frei · (c) rein manuell.
- **Empfehlung:** (b) — passt zur Invariante „Agent führt nie ohne Freigabe aus".
- ✅ **Chancen:** Kuratierung sichert Qualität/Vertrauen früh; skaliert später Richtung Automatik.
- ⚠️ **Risiken:** manuelle Kuratierung ist arbeitsintensiv und selbst der Engpass, wenn Volumen wächst.
- 🔍 **Wie andere es lösen:** **Good360**, **In Kind Direct** (UK), **Innatura** (DE) = kuratierter Katalog, Team prüft jede Spende/Bestellung; **Too Good To Go** = einziges echtes algorithmisches Matching. Cold-Start-Lehre (Paul Graham „Do things that don't scale"): **Airbnb/DoorDash/Lyft** starteten mit manuellem Concierge-Matching. a16z: ~67 % gescheiterter Marktplätze sterben an der **Angebotsseite** → zuerst Corporate-Überschuss-Liquidität aufbauen.
- **Beschluss:** ________________________

### M2 — Reihenfolge der Statemachine
- **Vorschlag:** `proposed → ngo_confirmed → both_confirmed → in_transit → delivered → completed` (cancelled nur Admin).
- **Empfehlung:** so lassen (Kontakt-Gate erst ab both_confirmed).
- ✅ **Chancen:** klar auditierbarer Lebenszyklus; Kontaktdaten erst nach beidseitiger Zusage = Trust-Boundary.
- ⚠️ **Risiken:** viele Zwischenzustände = mehr UI-/Test-Aufwand; „delivered vs. completed" muss klar definiert sein (wer bestätigt was).
- 🔍 **Wie andere es lösen:** klassisches Order-Fulfillment-Modell (proposed → confirmed → in transit → delivered) wie in E-Commerce/Logistik; das Kontakt-Gate-Muster kennt man aus Marktplätzen (Kontaktdaten erst nach Deal-Zusage, vgl. Immobilien-/Job-Plattformen).
- **Beschluss:** ________________________

### M3 — Teil-Erfüllung eines Bedarfs
- **Frage:** Mehrere Corporates auf einen NGO-Bedarf erlaubt? Verbraucht jeder Teil-Match eigene Quota?
- **Empfehlung:** Teil-Erfüllung mit Restmengen-Tracking; **jeder** bestätigte Match = 1 Quota.
- ✅ **Chancen:** deckt reale Bedarfe (große Menge, viele kleine Spender), höhere Erfüllungsquote.
- ⚠️ **Risiken:** Restmengen-Logik ist fehleranfällig (Überbuchung, Rundung); Quota-pro-Teilmatch kann Corporates abschrecken.
- 🔍 **Wie andere es lösen:** Katalog-Modelle (Good360/Innatura) buchen Bestellungen gegen verfügbaren Bestand mit Mengen-Dekrement — dasselbe Restmengen-Prinzip wie ein Warenkorb/Inventar.
- **Beschluss:** ________________________

### M4 — Abbruch: `cancelled` vs. `failed` + Erstattung
- **Frage:** Ein Abbruch-Zustand oder zwei (Storno vor Versand / Scheitern nach Versand)? Quota-Erstattung?
- **Empfehlung:** Zwei Zustände; Erstattung nur bei Scheitern ohne NGO-Verschulden, Storno erstattet nicht.
- ✅ **Chancen:** faire, nachvollziehbare Regeln; getrennte Zustände geben saubere Impact-/Erfolgs-Statistik.
- ⚠️ **Risiken:** „wer hat Schuld?" ist im Zweifel strittig → Ops-Schlichtung nötig; Erstattungsregel muss missbrauchssicher sein.
- 🔍 **Wie andere es lösen:** Marktplätze trennen „cancelled" (vor Erfüllung, oft kostenneutral) von „failed/disputed" (nach Versand, mit Klärungsprozess) — analog zu Storno vs. Reklamation im E-Commerce.
- **Beschluss:** ________________________

### M5 — Stale-Ablauf
- **Frage:** Läuft ein zu lange hängender Match automatisch ab? Frist?
- **Empfehlung:** 14 Tage in `proposed`/`ngo_confirmed` → auto-`expired`, keine Quota verbraucht.
- ✅ **Chancen:** hält die Pipeline sauber, keine ewig offenen Matches; Quota wird nicht blockiert.
- ⚠️ **Risiken:** zu kurze Frist frustriert langsame NGOs (ehrenamtlich, geringe Reaktionszeit); braucht Erinnerungs-Mails vor Ablauf.
- 🔍 **Wie andere es lösen:** Reservierungs-/Angebots-Systeme mit Ablauf-Timer sind Standard (Ticketing, Marktplatz-Angebote); wichtig ist die Vorwarnung, nicht nur der harte Cut.
- **Beschluss:** ________________________

### M6 — CO₂ / Impact-Faktoren
- **Frage:** Impact-Wert aus kuratiertem Faktor-Katalog (pro Kategorie) oder selbst-deklariert?
- **Empfehlung:** Kuratierter Faktor-Katalog (kein Freitext); Spendenwert bleibt separat (→ E3).
- ✅ **Chancen:** einheitliche, verteidigbare Impact-Zahlen (wichtig für CSRD/Marketing), nicht manipulierbar.
- ⚠️ **Risiken:** Faktoren müssen fachlich fundiert & aktuell sein — falsche Faktoren = Greenwashing-Vorwurf.
- 🔍 **Wie andere es lösen:** Nachhaltigkeits-Tools rechnen mit hinterlegten Emissionsfaktoren (z. B. DEFRA/GHG-Protocol-Datenbanken) statt Freitext; Too Good To Go weist pauschale CO₂-Ersparnis pro geretteter Bag aus (kuratierter Faktor, kein Nutzer-Input).
- **Beschluss:** ________________________

---

## Teil E — Produkt- & Rechts-Grundsatzentscheidungen

*Im Code verifiziert: diese vier Themenfelder sind heute **nicht** als echte Logik umgesetzt — sie bestimmen, was die Plattform überhaupt kann und wo sie rechtlich haftet.*

### E1 — Kernprodukt: der Matching-Flow
- **Worum es geht:** Das Herzstück der Plattform — aus einem NGO-Bedarf und einem
  Corporate-Überschuss entsteht ein verbindlicher Match. Heute existiert dafür **kein Flow**:
  in der DB liegen nur Seed-/Demo-Matches, es gibt kein `matches.create`. Man kann sich die
  Statemachine ansehen, aber kein Nutzer kann real einen Match auslösen.
- **Zu entscheiden:** Bauen wir den Matching-Flow als nächstes große Feature (nach der
  Verifizierung aus Teil C)? Welche Priorität gegenüber Payment (E2) und Redesign (Teil F)?
- **Empfehlung:** Ja, direkt nach AUTH/Verifizierung — ohne diesen Flow gibt es kein Produkt.
- ✅ **Chancen:** macht die Plattform überhaupt erst benutzbar; alles andere (Doku, Impact, Plan) hängt daran.
- ⚠️ **Risiken:** großes Feature — Statemachine, Quota, Chat, Kontakt-Gate; ohne Angebotsseite (Corporate-Liquidität) läuft der Flow leer.
- 🔍 **Wie andere es lösen:** siehe M1 — kuratierter Katalog + Concierge-Matching zum Start (Good360/Innatura), nicht sofort Vollautomatik. Erst Liquidität, dann Engine.
- **Beschluss:** ________________________

### E2 — Monetarisierung & Zahlungsabwicklung
- **Worum es geht:** Wie Firmen für ihren Plan (`registered`/`seed`/`tree`) bezahlen.
  Heute werden Pläne **manuell per RPC** (`set_company_plan`) gesetzt — es gibt keine
  Zahlung, keine Rechnung, keinen Self-Service-Upgrade.
- **Zu entscheiden:** Braucht der Launch echte Bezahlung (z. B. Stripe), oder starten wir
  mit manueller Freischaltung und rüsten Payment als Fast-Follow nach? Wer wird zur Kasse
  gebeten (nur Corporate-Upsell auf `tree`)?
- **Empfehlung:** Launch mit manueller Freischaltung; Stripe direkt danach.
- ✅ **Chancen:** manueller Start = schneller live, individuelle Deals möglich, kein Payment-Integrationsaufwand jetzt.
- ⚠️ **Risiken:** manuell skaliert nicht (jede Freischaltung ist Handarbeit) und wirkt bei Self-Serve-Kunden unprofessionell.
- 🔍 **Wie andere es lösen:** B2B-SaaS startet bei individuellem Pricing/hohem ACV bewusst mit **manueller Rechnung/Sales-Freischaltung** und wechselt zu **Stripe Self-Service**, sobald Pricing standardisiert + Volumen hoch ist (Mercury nennt 4 Signale: standardisiertes Pricing, hohes Kundenvolumen, Self-Serve-Onboarding, überwiegend Recurring).
- **Beschluss:** ________________________

### E3 — Spendenbewertung (Steuer- & Haftungsrecht)
- **Worum es geht:** Der ausgewiesene Spendenwert = Menge × **selbst-deklariertem**
  Einzelwert. Dieser Wert fließt in die **Spendenbescheinigung** → er ist steuerlich
  relevant und haftungskritisch. Ein zu hoch angesetzter Wert ist ein reales Steuer-/
  Fraud-Risiko für beide Seiten und für uns als Plattform.
- **Zu entscheiden:** Bleibt der Wert selbst-deklariert (mit Haftungsklausel/Bestätigung),
  oder brauchen wir Nachweis, Deckelung oder eine Steuerberater-Prüfung des Modells?
- **Empfehlung:** Founder-Entscheidung + Steuerberater einbinden; eigener ADR. **Nicht raten.**
- ✅ **Chancen:** ein sauber gelöstes Bewertungs-/Belegmodell ist ein echter Vertrauens- & Compliance-Vorsprung.
- ⚠️ **Risiken (konkret, belegt):** Rechtsgrundlage **§ 10b Abs. 3 EStG** — Privatvermögen: **gemeiner Wert** (§ 9 BewG, = Zeit-/Marktwert, **nicht** Neuwert); Betriebsvermögen: Entnahme-/Teilwert (§ 6 EStG) + USt, mit **Buchwertprivileg**. **Haftung (§ 10b Abs. 4):** bei überhöhtem Wert **30 % des zugewendeten Betrags** (+15 % GewSt bei betrieblichen Spenden) — und **vorrangig haftet die ausstellende NGO**. Ein bloß selbst behaupteter Spenderwert ist rechtlich angreifbar.
- 🔍 **Wie andere es lösen:** In DE ist das **Zuwendungsempfängerregister/BZSt** der Ausstellungs-Nachweis; für den Wert gibt es **keine dokumentierte Plattform-Standardpraxis** zu selbst-deklarierten Werten (Recherche-Flag). Konsequenz: Plattform sollte Werte **nie ungeprüft** in Bescheinigungen übernehmen, sondern **Belegpflicht** (Kaufbeleg/Wertermittlung) erzwingen. *(Keine Rechtsberatung — Steuerberater für den Einzelfall.)*
- **Beschluss:** ________________________

### E4 — Zugangsmodell: invite-only & Demo-Einstieg
- **Worum es geht:** Wie neue Nutzer überhaupt reinkommen. Heute ist alles einladungs-
  basiert; die Demo lebt in der Login-Maske. Frage ist, ob wir für Wachstum öffnen und wie
  Interessenten das Produkt gefahrlos ausprobieren.
- **Zu entscheiden:** Bleibt es invite-only (bis die Verifizierung aus Teil C steht)? Wird
  die Demo ein eigener, klar getrennter Einstieg statt Teil des Logins? „Zugang anfragen"
  als Lead-Capture? *(hängt eng mit F1/F3 zusammen)*
- **Empfehlung:** Invite-only bis Verifizierung steht; Demo als eigener Einstieg + Lead-Capture.
- ✅ **Chancen:** invite-only erzeugt Knappheit/Qualität und passt zur Verifizierungs-Pflicht; Lead-Capture sammelt Interessenten schon vor Öffnung.
- ⚠️ **Risiken:** zu geschlossen bremst Wachstum; Waitlist ohne Nachfassen verliert Leads.
- 🔍 **Wie andere es lösen:** **Superhuman** (invite-only + 30-Min-Concierge-Onboarding, Referrals überspringen die Queue), **Robinhood** (große Pre-Launch-Waitlist mit Queue-Position + Referral), **Mercury/Brex/Ramp** (KYB-gated Signup) — genau das Muster „Waitlist + verifikationsgebundener Zugang".
- **Beschluss:** ________________________

---

## Teil F — App-Redesign / UI *(aus `app-redesign-north-star.md`, Status: Entwurf)*

*Weniger kritisch als C–E, aber offen. UI-1/UI-3 überschneiden sich mit E4 — dort mitentscheiden, hier nur verfeinern.*

### F1 (UI-1) — Auth-Backend live schalten?
- **Frage:** Auth-Supabase jetzt live bringen (Staging/Prod) oder Prod bewusst **demo-only** lassen?
- **Kontext:** Blockiert echte Workspace-UI-Tests in Prod (eingeloggte Ansichten sind live nicht erreichbar).
- **Empfehlung:** Staging live schalten (an A4 gekoppelt), Prod erst nach Verifizierungs-Policy (C).
- ✅ **Chancen:** echte End-to-End-Tests der eingeloggten Flows werden möglich.
- ⚠️ **Risiken:** Prod live ohne Verifizierung (C) offen = Fake-Konten könnten rein → an C koppeln.
- 🔍 **Wie andere es lösen:** Standard-Staging-First — erst auf isoliertem Staging live, Prod erst wenn Zugangs-/Verifizierungs-Policy steht.
- **Beschluss:** ________________________

### F2 (UI-2) — Demo: geteilter Login vs. Gast-Session
- **Frage:** Ein gemeinsamer Demo-Login (alle sehen dasselbe) oder pro Besucher isolierte Session?
- **Empfehlung:** Isolierte Gast-Session (kein Datenleck zwischen Interessenten), falls Aufwand vertretbar.
- ✅ **Chancen:** isoliert = jeder Interessent hat saubere Daten, kann gefahrlos „echt" klicken.
- ⚠️ **Risiken:** geteilter Login = Nutzer sehen gegenseitige Eingaben/Kollisionen; isoliert = mehr Bau-Aufwand.
- 🔍 **Wie andere es lösen:** **Stripe Test Mode** (geteilt, einfach, aber Kollisionen) vs. **Stripe/Salesforce Sandboxes** (voll isoliert pro Nutzer). Alternativ geführte Demo-Captures ohne Live-Produkt (**Navattic, Storylane, Arcade**) oder daten-populierte Replicas (**Reprise, Walnut**).
- **Beschluss:** ________________________

### F3 (UI-3) — Selbst-Registrierung / Lead-Capture
- **Frage:** Invite-only beibehalten? „Zugang anfragen" als Lead-Capture ja/nein? *(= E4, hier nur bestätigen)*
- **Empfehlung:** Invite-only + „Zugang anfragen"-Lead-Capture bis Verifizierung steht.
- ✅ **Chancen / ⚠️ Risiken / 🔍 Praxis:** identisch zu **E4** — dort entscheiden, hier nur die UI-Umsetzung spiegeln.
- **Beschluss:** ________________________

### F4 (UI-4) — Serif-Einsatz im Workspace
- **Frage:** Serif ganz raus aus dichten Views oder nur in Listen behalten?
- **Empfehlung:** Serif nur für Headlines/Marketing, raus aus dichten Daten-Views.
- ✅ **Chancen:** klare Typo-Hierarchie (Serif = Marke/Headline, Sans = Daten) wirkt professioneller.
- ⚠️ **Risiken:** Serif in dichten Tabellen mindert Lesbarkeit; reine Geschmacksfrage → nicht überoptimieren.
- 🔍 **Wie andere es lösen:** verbreitetes Muster „Serif für Display/Headline, Sans-Serif für UI/Datenflächen" (viele Design-Systeme trennen Display- und Text-Fonts).
- **Beschluss:** ________________________

### F5 (UI-5) — Akzent-Farben Corporate vs. NGO
- **Frage:** Konkrete Farbwerte für Corporate (kühl: Teal/Grün) vs. NGO festlegen?
- **Empfehlung:** Flo entscheidet Markenfarben; ich setze Tokens um, sobald benannt.
- ✅ **Chancen:** rollen-eigene Akzentfarbe macht sofort erkennbar, in welchem Kontext man ist.
- ⚠️ **Risiken:** Barrierefreiheit (Kontrast/Farbfehlsichtigkeit) beachten; Farben nie als einziges Unterscheidungsmerkmal.
- 🔍 **Wie andere es lösen:** rollen-/mandantenbasierte Akzentfarben über Design-Tokens (Theming) sind Standard; WCAG-Kontrast als Leitplanke.
- **Beschluss:** ________________________

---

## Zur Kenntnis — keine Entscheidung nötig *(nur informieren)*

Aus dem Repo-Sweep, damit Flo den Stand kennt — hier ist **nichts zu beschließen**:

- **Erledigt:** Clickwrap-Enforcement (Corp-Bestätigung + NGO-Gegenzeichnung) ✅ · Font-CI-Bruch behoben ✅ · TLS/`surpluspurpose.com` über Cloudflare abgesichert ✅
- **Bewusst Backlog:** Mistral-LLM-Listenparser (deterministischer CSV/XLSX-Parser deckt Launch ab) · Ops/Admin-Härtung Phase F/G · echter XLSX-Bulk-Parser
- **Offene Dev-Arbeit (Reihenfolge, kein Founder-Call):** i18n DE/EN in Panels + `/de`/`/en`-Routing (heute nur `?lang=`) · Mobile-Sektions-Navigation (Sidebar unter `lg` versteckt) · DOC-Bereich (Upload/E-Signatur ehrlich entfernt, bis gebaut)
- **Optional-Cleanup:** alte Netlify-DNS-Zone / DNSSEC in Cloudflare

---

## Nach dem Termin — Umsetzungs-Notizen (fülle ich aus)

- [ ] Beschlüsse A1–A5 → Repo/Netlify/GitHub umsetzen
- [ ] B1–B5 → Katalog-Format finalisieren, Beispiel-REQ real machen
- [ ] C1–C5 → ADR 0027 auf `Accepted`, Corporate-Pipeline-REQs schreiben
- [ ] M1–M6 → `REQ-MATCH-01..06` + ADR 0028 schreiben
- [ ] E1–E4 → Roadmap/ADR-Stubs, ggf. Steuerberater-Frage (E3) notieren
- [ ] F1–F5 → `app-redesign-north-star.md` aktualisieren, Farb-Tokens/Serif-Regeln setzen

---

## Quellen & Vorbehalte *(zu den 🔍-Beispielen)*

Die „Wie andere es lösen"-Beispiele stammen aus einer Web-Recherche (offizielle Anbieter-Seiten
+ Fachquellen). Wichtige Vorbehalte, damit nichts falsch zitiert wird:

- **E3 (Steuer) ist keine Rechtsberatung**, sondern eine Zusammenfassung von Rechtsquellen
  (§ 10b / § 6 EStG, § 9 BewG; winheller.com, haufe.de). Für den Einzelfall Steuerberater.
- **Keine belegte Plattform-Standardpraxis** zu *selbst-deklarierten* Sachspendenwerten gefunden —
  E3-Empfehlung „Belegpflicht" ist daher aus der Haftungslage abgeleitet, nicht abgeschaut.
- **Kein offizielles öffentliches Handelsregister-API in DE** (nur Reseller) — KYB-Automatik
  stützt sich auf VIES + ggf. Reseller.
- Korrektur ggü. erster Fassung: **Alaya gehört zu Benevity** (nicht Workday).
- „**Spenden statt Wegwerfen**" ist ein generischer Slogan, **kein** benennbares Vorbild.
- Vendor-Statistiken (z. B. Walnut-Conversion-Zahlen) sind selbst-berichtet — nur als Indiz.

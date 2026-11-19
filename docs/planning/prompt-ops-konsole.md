# Claude-Code-Prompt — Ops-Konsole Schritt 1 (read-only)

> Kopiervorlage für Claude Code im Repo `sur.plus`. Erst Plan, dann Code.
> Stand: 2026-08-23. Konfliktgrenze gegen Andis offene Branches ist Teil des Auftrags.

---

Du arbeitest im Repo `sur.plus` (Monorepo, `apps/web` + `packages/domain` + `supabase`).
Lies zuerst `AGENTS.md`, dann `docs/adr/0025-e25-ops-risk-queue.md`, `0026-match-quota-counting.md`,
`0027-registration-verification-policy.md` und `0023-e23-ops-role-guard.md`. Halte dich strikt an
die dort dokumentierten Muster und Invarianten — besonders: Writes nur über Postgres-RPCs,
Audit-Eintrag bei jeder sicherheitsrelevanten Mutation, ein Match-State-Machine-Feld,
Entitlement = Matches pro Vertragsjahr, "Corporate"/"NGO" als einzige Begriffe.

## Ziel

Der Adminbereich soll die Frage beantworten, die heute nur eine Excel-Datei beantwortet:
**Wer sind unsere Kunden und Partner, in welchem Zustand sind sie, und was muss ein Mensch
gerade anfassen?** Schritt 1 ist bewusst **read-only** — eine Projektion über Daten, die der
Admin-Actor ohnehin sehen darf, analog zur Entscheidung in ADR 0025. Keine neuen Schreibpfade,
keine neuen Privilegien, kein neues Datenmodell.

## Scope (genau das, nicht mehr)

1. **`/ops/customers`** — Tabelle aller `companies`:
   Name, Plan (`registered`/`seed`/`tree`), Verifizierungsstatus, belegte Seats vs.
   `plan_entitlements.user_seats`, im laufenden Vertragsjahr verbrauchte Matches vs. Kontingent
   (Zählung strikt nach ADR 0026: verbraucht bei `both_confirmed`), offene Matches nach State,
   letzte Aktivität. Sortier- und filterbar nach Plan und Verifizierungsstatus.
2. **`/ops/ngos`** — Tabelle aller `ngos`: Verifizierungsstatus, vorliegende
   Verifizierungsdokumente inkl. Datum, Anzahl offener Bedarfe, laufende Matches,
   letzte Aktivität.
3. **`GET /api/ops/metrics`** — read-only, admin-only, im API-Contract deklariert mit
   Read-Rate-Limit-Policy. Liefert die kanonischen Zahlen: verifizierte NGOs, offene Bedarfe,
   Matches je State, Companies je Plan. **Begründung:** dieselbe Kennzahl steht heute in Skills,
   Pitch-Decks, Outbound-Vorlagen und auf der Landingpage in sechs verschiedenen Ausprägungen.
   Dieser Endpoint wird die einzige Quelle. Nimm das in den ADR auf.

Die Projektionslogik gehört als **pure, deterministische Funktion nach `packages/domain`**
(Muster: `packages/domain/src/ops-risk-queue.ts` mit `buildOpsRiskQueue`), mit Unit-Tests,
Re-Export in `index.ts`. Die Route und die UI sind dünne Schichten darüber.

## Nicht-Ziele in diesem Schritt

- Keine Schreibaktionen im UI (Plan ändern, verifizieren, sperren) — `set_company_plan` existiert
  bereits als admin-only RPC mit Audit und bleibt vorerst der einzige Weg. Schreibpfade sind
  Schritt 2, eigener PR.
- Kein Prospect-/Lead-Management, kein Vertriebs-Pipeline-Board. Vor der Registrierung lebt alles
  weiter in `07_SALES/sur.plus_Outbound.xlsx`. Die Grenze ist bewusst: **Excel = vor der
  Registrierung, App = ab der Registrierung.**
- Keine Rechnungen, keine Beträge, kein Zahlungsstatus. Buchhaltung und E-Rechnung laufen über ein
  externes Tool; der einzige Zahlungsanker in der App bleibt `companies.plan`.
- Keine neue Migration, wenn die Daten über bestehende Tabellen und RLS erreichbar sind. Falls doch
  eine RPC nötig ist (z. B. für eine Aggregation, die RLS sonst nicht sauber zulässt): erst
  vorschlagen, begründen, meine Freigabe abwarten.
- Kein i18n-Umbau, kein Refactor bestehender Dashboard-Komponenten.

## Konfliktgrenze — wichtig

Andreas arbeitet parallel am Login-Minispiel, an den Benutzereinstellungen im Corporate- und
NGO-Bereich und an den Benachrichtigungen. Auf `origin` liegen dazu drei **noch nicht gemergte,
gestapelte** Branches: `feature/in-app-notifications` (die neueste, umfasst die anderen),
`feature/match-notifications`, `feature/catalog-exclude-goods`. Sie fassen unter anderem
`components/dashboard/AdminCockpit.tsx`, `AdminDashboard.tsx`, `CorporateCockpit.tsx`,
`NgoCockpit.tsx`, `shared.tsx`, `ProfileEditForm.tsx`, `account/page.tsx` und `app/lib/i18n.ts` an
und enthalten bereits Ops-Arbeit ("i18n: translate the Ops cockpit", "ranked match suggestions
for Ops").

Daraus folgt für dich:

- Branch `feat/ops-kundenkonsole` von `main`.
- **Lege ausschließlich neue Dateien an.** Fasse keine der oben genannten Dateien an.
  Die neuen Views bekommen eigene Routen (`app/ops/customers/`, `app/ops/ngos/`) und eigene
  Komponenten, nicht neue Sektionen in `AdminCockpit.tsx`.
- Einzige erlaubte Ausnahme: ein Navigationslink zu den neuen Routen. Wenn der nur in einer der
  Konfliktdateien möglich wäre, lass ihn weg und sag mir Bescheid — ich verlinke später von Hand.
- Prüfe zu Beginn mit `git log --oneline origin/main..origin/feature/in-app-notifications`, ob
  Andis Stack inzwischen gemergt ist. Falls ja: von `main` neu branchen und die Einschränkung
  entfällt teilweise — sag mir dann, was du zusammenlegen würdest.

## Vorgehen

1. **Erst Plan, kein Code.** Lies dich ein und liefere: welche Dateien du anlegst, welche
   Domain-Funktion(en) mit welcher Signatur, welche Felder je Tabelle, wie die Quota-Berechnung
   nach ADR 0026 aussieht, ob eine RPC nötig ist, welche Tests du schreibst.
2. Nenne dabei ausdrücklich alle **offenen Produktentscheidungen** als Frage an mich statt sie zu
   raten (AGENTS.md: "Open product decisions are founder calls"). Erwartbare Kandidaten: Was zählt
   als "letzte Aktivität"? Ab wann gilt eine NGO-Verifizierung als abgelaufen? Zählt `registered`
   als Kunde oder als Lead?
3. Nach meiner Freigabe: ADR `docs/adr/0031-ops-customer-console.md` schreiben (Kontext,
   Entscheidung, Implementierung, Next Steps — Format wie 0025), dann implementieren.
4. Ein Concern pro Commit, Conventional Commits, keine Refactors dazwischen.

## Fertig ist es, wenn

- Beide Views laden in **beiden Runtimes** (preview über `x-surplus-preview-user-id` mit den
  Seed-Usern, und supabase) und zeigen für `usr-admin-ops` plausible Daten.
- Ein Nicht-Admin bekommt auf allen drei neuen Pfaden `403`/Redirect — mit Test.
- `GET /api/ops/metrics` ist in `packages/domain/src/api-contract.ts` deklariert, rate-limited,
  und die Zahlen stimmen mit dem überein, was die Views anzeigen.
- Die Domain-Projektion hat Tests für: leere Datenlage, Company ohne Matches, Company über
  Kontingent, NGO in jedem Verifizierungsstatus.
- Verify-Loop grün:
  ```
  pnpm --filter @surplus/domain test
  pnpm --filter @surplus/domain typecheck
  pnpm --filter @surplus/web typecheck
  pnpm --filter @surplus/web build
  ```
- `git diff --name-only main...HEAD` enthält **keine** der oben genannten Konfliktdateien.

Zeig mir am Ende die Dateiliste, die Diff-Größe und einen Screenshot-Beschrieb der beiden Views.

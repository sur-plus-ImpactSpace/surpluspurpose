# M1 — Befunde des ersten echten Supabase-Durchlaufs

Stand: 2026-07-11 · Kontext: erstes Mal, dass der *eingeloggte* Teil gegen ein echtes
Supabase-Projekt (`surplus-staging`) lief. Input für den Redesign (M3) und die
Härtung vor Go-Live.

## Was verifiziert ist (grün)

- **Auth-Gate**: mit Supabase-Env leitet `/` → `/login`, `/demo` bleibt offen. Ohne Env
  (Prod) weiter Demo-only. Genau wie gewollt.
- **Magic-Link-Login** (florian@surpluspurpose.com) + **Ops-Bootstrap** (Token) → Admin-
  Profil, `/ops` rendert echte Seed-Daten.
- **Kompletter Match-Lebenszyklus** (DB-Invarianten-Proof, security-definer-Rollen simuliert,
  in Transaktion, zurückgerollt):
  `proposed → ngo_confirmed → both_confirmed → in_transit → delivered → completed`.
  - `committed_at` wird bei `both_confirmed` gesetzt.
  - Bei `completed` entstehen automatisch **2 Dokumente**: Spendenbescheinigung +
    CSRD-Note, beide `approved`.
- **Negativ-Checks**:
  - NGO-Kontakt **verborgen vor** `both_confirmed`, **sichtbar danach** (Trust-Boundary).
  - Quota: 2. Commit über Plan-Grenze → `match_quota_exceeded`.
  - Ungültiger Sprung (Admin `ngo_confirmed → completed`) → `invalid_transition`.
  - Rollen-Gating implizit bewiesen (jede Transition verlangte die korrekte Rolle).

## Rough Edges (für Redesign / Härtung)

1. **[KRITISCH — behoben]** RLS-Endlosrekursion (`42P17`) in den SELECT-Policies von
   `matches`/`listings`/`needs` ließ den *gesamten* eingeloggten Teil beim ersten echten
   Supabase-Load abstürzen. Behoben in Migration `0005_fix_rls_recursion.sql`
   (cross-table-Checks jetzt in security-definer-Funktionen). Hätte den Go-Live blockiert.

2. **[Fehlerbild]** Nach dem DB-Fix wurde kurz die **gecachte Fehlerseite** ausgeliefert
   („Something went wrong"), obwohl der Fehler weg war — erst eine frische Navigation
   zeigte den korrekten Zustand. Die Error-Boundary sollte nicht „kleben"; ein echter
   Retry sollte serverseitig neu laden.

3. **[Fehler-Copy]** Generisches „Something went wrong (reference NNN)" verbirgt die
   Ursache **auch auf Staging**. Das hat hier echte Debug-Zeit gekostet. Staging/Dev-Build
   sollte Digest/Message durchreichen (Prod weiter anonym).

4. **[Login / Nordstern]** `/login` zeigt weiter „Explore the demo workspace" +
   Calendly-Zeile. Laut Nordstern soll der Login sauber ohne Demo-Verflechtung sein —
   Demo als eigener Einstieg, nicht in der Anmeldemaske.

5. **[Login-Formular]** Beim ersten Versuch war das E-Mail-Feld nach dem Absenden leer
   (musste neu getippt werden) — möglicher Hydration-/Focus-Race vor Interaktivität.
   Prüfen, ob das Feld vor Hydration State verliert.

6. **[Onboarding-Lücke]** Frisch eingeloggter User ohne Workspace-Profil, der **kein**
   Allowlist-Admin ist, landet auf „Workspace access pending" ohne Selbst-Bedien-Pfad.
   Für invite-only ok, aber der Leerzustand sollte auf „Zugang anfragen" zeigen.

## Offene Punkte nach M1

- Migration `0005` ist auf Staging angewandt **und committet** (main). Muss beim Go-Live
  auch auf die Prod-DB — Prod bleibt bis dahin bewusst ohne Supabase-Env (Gate).
- Voller **UI**-Klick-Durchlauf (Corporate/NGO eingeloggt) steht noch aus; die Logik ist
  per DB-Proof bestätigt, die UX der eingeloggten Corporate/NGO-Ansichten kennen wir
  bisher nur aus `/demo` (gleiche Komponenten).
- Redesign-Reihenfolge unverändert (siehe `app-redesign-north-star.md`): Demo-als-Account +
  sauberer Login → route-basierte IA → Farbe/Serif.

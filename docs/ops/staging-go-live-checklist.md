# Staging-Deploy-Checkliste (develop → echtes Testen)

Stand: 2026-08-03. Ziel: Der `develop`-Branch soll auf der Staging-Umgebung
**wirklich benutzbar** sein (Login, Registrierung, Mails, Verifizierung), ohne
Produktion anzufassen.

Diese Liste trennt bewusst: **[✅ erledigt]**, **[🔧 Dashboard]** (kein Code —
Einstellungen bei Supabase/Netlify, teils nur von Flo als Org-Owner machbar) und
**[👀 Test]**.

Projekt-Referenzen:
- Staging-Supabase: `surplus-staging`, ref `cqtokfnwteuctezqkkqo` (Org `pjzlfqayirntbprogjrz`)
- Staging-Netlify: der `develop`-Branch-Deploy der App-Site
- Ausführliche Mail-Einrichtung: siehe `auth-email-delivery-runbook.md`

---

## 1. Datenbank-Schema [✅ erledigt 2026-08-03]

- [x] Migrationen **0022–0026** auf `surplus-staging` angewendet
  (Personenfelder, Empfänger-Organisationstyp, NGO- und Corporate-
  Verifizierung, Proof→State).
- [x] Migrations-History initialisiert (`supabase migration repair` +
  `db push`) — ab jetzt genügt `supabase db push` für neue Migrationen,
  keine Handarbeit mehr im SQL-Editor nötig.
- [x] Verifiziert: neue Spalten/Tabellen/Buckets/Enums vorhanden,
  `migration list` zeigt 0001–0026 lokal == remote.

> Für **künftige** Migrationen (z. B. wenn wir am Feature weiterbauen und eine
> neue `00xx_*.sql` dazukommt):
> `supabase link --project-ref cqtokfnwteuctezqkkqo` (einmalig) →
> `supabase migration list --linked` (Trockenlauf) → `supabase db push`.

---

## 2. Supabase-Dashboard: Auth & Mail [🔧 Dashboard — Flo/gemeinsam]

Im Projekt `surplus-staging` unter **Authentication**:

- [ ] **URL Configuration** → Site URL + Redirect URLs auf die echte
  Staging-Domain des `develop`-Deploys setzen (nicht `127.0.0.1`).
  Redirects als `https://<staging-domain>/**`.
- [ ] **Custom SMTP** einrichten (sonst kommen Bestätigungs-/Reset-/Magic-Link-
  Mails nicht an — nur der eingebaute Supabase-Notversand, stark limitiert).
  Empfehlung: Resend (`smtp.resend.com:587`). **Details + Absender + die vier
  Templates: `auth-email-delivery-runbook.md`.**
- [ ] **Rate Limit** `email_sent` von 2 auf **~30/h** hochsetzen
  (Auth → Rate Limits), sonst blockiert schon der zweite Testversuch.
- [ ] Entscheidung **E-Mail-Bestätigung** (`enable_confirmations`): für den
  realistischen Test **an**, damit der „Bestätigungsmail erneut senden"-Flow
  greift.

Optionale Härtung (kann später):
- [ ] **Leaked-Password-Schutz** (HIBP) aktivieren.
- [ ] **MFA-Pflicht** für Admins.

---

## 3. Bot-Schutz: Turnstile [🔧 Dashboard]

Der Login/die Registrierung ist mit Cloudflare Turnstile geschützt. Er ist
**„alles oder nichts"**: Server-Captcha an, aber Client-Key fehlt → jeder Login
wird abgelehnt. Also beides zusammen setzen.

- [ ] Echte **Turnstile-Keys** anlegen (Cloudflare-Dashboard, Domain =
  Staging-Domain): Site-Key (öffentlich) + Secret (geheim).
- [ ] Supabase → Auth → **Captcha protection**: an, Secret eintragen.
- [ ] Netlify-Env `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = Site-Key (siehe Abschnitt 4).

> Zum reinen Durchklicken ohne echte Keys gibt es Cloudflare-Testschlüssel
> (Site `1x00000000000000000000AA`, Secret `1x0000000000000000000000000000000AA`) —
> die akzeptieren jeden Dummy-Token. Für einen echten Test aber echte Keys nehmen.

---

## 4. Netlify: Umgebungsvariablen (nur Branch-/Staging-Kontext) [🔧 Dashboard]

Netlify → App-Site → Environment variables. **Wichtig:** Werte nur für den
**Staging-/Branch-Deploy** setzen, Produktion muss leer bleiben (das ist die
bewusste Sperre, die Prod bis zum Launch offline hält — AGENTS.md-Invariante).

| Key | Wert |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Projekt-URL von `surplus-staging` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon`/publishable Key (Staging) |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role`/secret Key (Staging) — **nie in Git, nie NEXT_PUBLIC_** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile Site-Key |
| `SURPLUS_ADMIN_BOOTSTRAP_TOKEN` | langer Zufallsstring (`openssl rand -hex 24`) |
| `SURPLUS_ADMIN_BOOTSTRAP_EMAILS` | `florian@surpluspurpose.com` (+ ggf. Andis Mail) |

Keys findest du in Supabase → Project Settings → API.

**Gefahren-Check nach dem Speichern:** Im Produktions-Kontext dürfen KEINE
Supabase-Werte stehen.

---

## 5. Durchklick-Test auf Staging [👀 Test]

Sobald 2–4 stehen, `develop` ist deployt:

- [ ] Staging-URL öffnen → `/` leitet auf `/login` (kein Session).
- [ ] **Registrierung Corporate**: Anrede/Titel/Vor-/Nachname + Firma →
  Bestätigungsmail kommt an (Resend) → bestätigen → Workspace.
- [ ] **Registrierung NGO**: inkl. Organisationstyp-Dropdown → Nachweis-Upload
  im Dashboard sichtbar (Bucket `ngo-verification`).
- [ ] **Corporate-Verifizierung**: Nachweis-Upload sichtbar (Bucket
  `company-verification`).
- [ ] **Passwort vergessen** für beide Rollen: Reset-Mail → neues Passwort →
  alter/neuer Login wie erwartet.
- [ ] **Turnstile**: Login ohne gelösten Captcha wird abgelehnt.
- [ ] **Ops**: `/ops/bootstrap` mit `SURPLUS_ADMIN_BOOTSTRAP_TOKEN` → Admin →
  Verifizierungs-Warteschlange zeigt die hochgeladenen Nachweise.
- [ ] Jede Ecke, die hakt (Texte, Sackgassen, Fehler), notieren.

---

## Wer macht was

- **Andi/Claude:** DB-Migrationen ✅, künftige Migrationen per `db push`, Code.
- **Flo (Org-Owner):** SMTP + Turnstile-Secret im Supabase-Dashboard, Netlify-
  Env-Variablen, Domain/Redirects. (Andi kann Teile machen, wenn er in der Org
  ausreichende Rechte hat — sonst Flo.)

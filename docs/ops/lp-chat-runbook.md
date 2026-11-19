# LP Live-Chat — Setup-Runbook

Der Live-Chat auf surpluspurpose.com ersetzt WhatsApp als Kanal. Architektur:
statisches Widget (`chat.js`, cookieless, Thread-ID in localStorage) → Netlify
Function (`netlify/functions/chat.js`) → Supabase-Tabelle (EU, service-role only)
→ Resend-Mail an florian@ bei jeder Besuchernachricht. Antworten über
`https://surpluspurpose.com/chat-ops.html` (Token-geschützt, noindex).

**Wichtig:** Das ist ein EIGENES Supabase-Projekt (oder das Staging-Projekt) —
niemals das spätere Produktions-Projekt der App, und es berührt die
Login-Gate-Regel der App nicht (App-Site bekommt weiterhin keine Supabase-Envs).

## 1. Supabase-Projekt (einmalig, ~5 Min)

1. https://supabase.com/dashboard → New project → Name `surplus-lp-chat`,
   Region **EU (Frankfurt)**, starkes DB-Passwort (nur ablegen, wird nicht gebraucht).
2. SQL Editor → folgendes ausführen:

```sql
create extension if not exists pgcrypto;

create table public.lp_chat_messages (
  id            uuid primary key default gen_random_uuid(),
  thread_id     uuid not null,
  sender        text not null check (sender in ('visitor','florian')),
  body          text not null check (char_length(body) between 1 and 2000),
  visitor_email text,
  lang          text,
  page          text,
  created_at    timestamptz not null default now()
);

create index lp_chat_thread_idx on public.lp_chat_messages (thread_id, created_at);
create index lp_chat_created_idx on public.lp_chat_messages (created_at desc);

-- RLS an, KEINE Policies: anon/authenticated kommen nicht an die Tabelle,
-- nur die Netlify Function mit dem service-role Key.
alter table public.lp_chat_messages enable row level security;
```

3. Project Settings → API: `Project URL` und `service_role` Key kopieren.

## 2. Netlify-Envs (LP-Site, einmalig)

Netlify → LP-Site → Site settings → Environment variables:

| Variable | Wert |
|---|---|
| `CHAT_SUPABASE_URL` | Project URL aus Schritt 1 |
| `CHAT_SUPABASE_SERVICE_KEY` | service_role Key aus Schritt 1 |
| `CHAT_OPS_TOKEN` | langer Zufallsstring, z. B. `openssl rand -hex 24` — NUR du kennst ihn |

`RESEND_API_KEY` ist für die Report-Funktionen bereits gesetzt und wird mitgenutzt.
Danach: Deploy triggern (jeder Push reicht).

## 2b. Telegram-Push (optional, ~10 Min)

Echte Push-Notification aufs Handy bei jeder Besuchernachricht:

1. Telegram → **@BotFather** anschreiben → `/newbot` → Name z. B. `sur.plus Chat`,
   Username z. B. `surplus_chat_bot` → BotFather gibt dir den **Bot-Token**.
2. Deinem neuen Bot eine beliebige Nachricht schicken (z. B. „hi") —
   sonst darf er dir nicht schreiben.
3. Deine **Chat-ID** holen: im Browser
   `https://api.telegram.org/bot<TOKEN>/getUpdates` öffnen →
   im JSON steht `"chat":{"id":123456789,...}` — diese Zahl ist die Chat-ID.
4. Netlify-Envs auf der LP-Site ergänzen:

| Variable | Wert |
|---|---|
| `CHAT_TELEGRAM_BOT_TOKEN` | Token aus Schritt 1 |
| `CHAT_TELEGRAM_CHAT_ID` | Zahl aus Schritt 3 |

Fehlen die beiden Variablen, wird Telegram einfach übersprungen —
die E-Mail-Benachrichtigung läuft unabhängig davon immer.

## 3. Benutzung

- **Du antwortest** auf https://surpluspurpose.com/chat-ops.html — Token eingeben
  (bleibt pro Browser-Session gespeichert). Die Mail-Benachrichtigung enthält
  einen Direktlink in den richtigen Thread.
- **Benachrichtigung:** Bei jeder Besuchernachricht geht eine Mail an
  florian@surpluspurpose.com (Reply-To = Besucher-Mail, falls angegeben) —
  plus Telegram-Push, wenn konfiguriert (2b). Beide enthalten den
  Direktlink in den richtigen Ops-Thread.
- **Geschäftszeiten:** Widget zeigt 8–18 Uhr (Europe/Berlin) als erreichbar;
  außerhalb entschuldigt es die Wartezeit und bittet um E-Mail-Adresse.

## Verhalten ohne Konfiguration

Solange die Envs fehlen, antwortet die Function mit 503 `chat_not_configured`;
das Widget zeigt dem Besucher die Fehlermeldung mit E-Mail-Fallback
(service@surpluspurpose.com). Nichts bricht.

## Datenschutz

- Keine Cookies; Thread-ID (Zufalls-UUID) + optionale Antwort-Mail in localStorage.
- Speicherung in Supabase (EU). Privacy Policy auf der LP ist entsprechend
  aktualisiert (Abschnitt „Live chat").
- Löschung auf Zuruf: im Supabase SQL Editor
  `delete from lp_chat_messages where thread_id = '<id>';`

## Spam-Schutz

Honeypot-Feld, Längenlimit (2000 Zeichen), max. 40 Besuchernachrichten pro
Thread/Stunde (429). Bei Bedarf später: Turnstile o. Ä. — bewusst noch nicht.

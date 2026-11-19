# Auth & e-mail delivery runbook

Why a freshly registered NGO or company sometimes sees *"Check your email"* but
no mail arrives — and exactly what to change to fix it on staging and
production. Written for the login launch; the code side is done, the remaining
steps are **manual Supabase-dashboard configuration** (Flo/owner).

## The two e-mail paths (they are not the same system)

sur.plus sends two completely separate kinds of e-mail. Only one of them is
broken on deploy, and they are fixed in different places.

| Path | What it sends | Who sends it | Where it is configured |
|------|---------------|--------------|------------------------|
| **Supabase Auth** | Sign-up confirmation, magic-link sign-in, password reset | Supabase's own SMTP | Supabase **Dashboard** → Authentication → Emails (SMTP + templates) |
| **Invitation** | "You have been invited to sur.plus" | Our own code via the **Resend** API (`app/api/_lib/invitation-email.ts`) | Env var `RESEND_API_KEY` (+ `SURPLUS_INVITE_FROM_EMAIL`), with a webhook fallback and an audit trail |

The invitation path already works wherever `RESEND_API_KEY` is set. **The path
that fails is Supabase Auth**, because Supabase's *built-in* SMTP is not a real
mail service — see below.

## The problem: Supabase's built-in SMTP is not for real users

On a hosted Supabase project **without a custom SMTP server**, auth e-mails go
through Supabase's shared demo sender. That sender:

- only reliably delivers to **your own team members** (project members), not to
  arbitrary NGO/company addresses;
- is throttled to a **handful of mails per hour** (see `auth.rate_limit.email_sent`,
  currently `2`);
- is explicitly documented by Supabase as **"not meant for production"**.

So the app correctly calls `signInWithOtp` / `resetPasswordForEmail` / sign-up,
shows *"Check your email"* — and the mail is silently dropped or never reaches a
real user. Nothing in our code is wrong; the mail transport is missing.

## Fix: point Supabase Auth at a real SMTP server (Resend SMTP)

Recommended: reuse the **same Resend account** already used for invitation
e-mails, so there is one sender identity and one place to watch deliverability.
Resend exposes SMTP credentials alongside its API.

**Do this once per hosted project (staging first, then production):**

1. Resend dashboard → verify the sending domain (`sur.plus`) with the DNS
   records Resend gives you (SPF + DKIM). Until the domain is verified, only the
   Resend test address works.
2. Resend → **SMTP** → copy host / port / user / password:
   - Host: `smtp.resend.com`
   - Port: `587` (STARTTLS) or `465` (TLS)
   - User: `resend`
   - Password: a Resend API key (can be the same `RESEND_API_KEY`).
3. Supabase Dashboard → project → **Authentication → Emails → SMTP Settings** →
   *Enable custom SMTP* and enter:
   - Sender email: `no-reply@sur.plus` (must match the verified Resend domain)
   - Sender name: `sur.plus`
   - Host/Port/User/Password from step 2.
4. Save. Send a test to a **non-team** address (e.g. a personal gmail) and
   confirm it arrives.

> config.toml note: the `[auth.email.smtp]` block in `supabase/config.toml` is
> for the **local** stack only. Local dev does not need it — the local stack
> catches all mail in **Mailpit** (`http://127.0.0.1:54324`). Hosted SMTP lives
> in the dashboard, not in this file. Leave the block commented locally.

## Also required for auth links to work on deploy: Site URL & redirects

Auth e-mail links and OAuth/magic-link redirects are built from **Site URL** and
must match an allow-list. In `supabase/config.toml` these are still local:

```
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000", "http://localhost:3000/**", "http://127.0.0.1:3000", "http://127.0.0.1:3000/**"]
```

(These are the **local** values in `supabase/config.toml`. The hosted projects
use the real deployed origin — set below.)

On each hosted project set the **real** values in Dashboard → Authentication →
URL Configuration:

- **Site URL**: the deployed app origin (e.g. `https://app.surpluspurpose.com`).
- **Redirect URLs**: add every origin the app runs on, including Netlify deploy
  previews if magic-link/reset should work there.

Wrong Site URL = the confirmation link points at `127.0.0.1` and dies in the
user's browser, even when the mail itself is delivered.

## Wire the branded templates

Four branded templates already exist in `supabase/templates/`. They are **not**
active until pasted into the dashboard. Follow the table in
[`supabase/templates/README.md`](../../supabase/templates/README.md):
Dashboard → Authentication → Emails → Templates, paste each file, set the
subject. Do this per hosted project.

## After SMTP is live: raise the rate limit and decide on confirmations

- **Rate limit** (`supabase/config.toml`, `[auth.rate_limit] email_sent = 2`):
  `2/hour` is a safety cap for the built-in sender. Once real SMTP is live, raise
  it (e.g. `30`) in config **and** in the dashboard rate-limit settings — otherwise
  a launch day with a dozen sign-ups hits the wall.
- **`enable_confirmations`**: `false` locally (so signup logs straight in without
  a confirmation mail). For staging/production this is a **product decision** —
  requiring e-mail confirmation before first sign-in is the safer default, but it
  makes working delivery a hard prerequisite. → **founder call (Flo).**

## Bot protection: Cloudflare Turnstile is all-or-nothing

The auth forms run a Cloudflare Turnstile bot-check. It has a **server half** and
a **client half**, and they must be enabled *together* — enabling one without the
other breaks sign-in:

| Half | Where | Local value | Staging/prod value |
|------|-------|-------------|--------------------|
| Server | `[auth.captcha]` in `supabase/config.toml` (local) / Dashboard → Authentication → Bot & Abuse Protection (hosted) | `enabled = true`, provider `turnstile`, secret = Cloudflare **test** secret `1x0000000000000000000000000000000AA` (always passes) | real Turnstile **secret** key |
| Client | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` env var | Cloudflare **test** site key `1x00000000000000000000AA` (always passes) | real Turnstile **site** key |

**Failure mode if they drift:** server captcha ON + client site key unset → no
widget renders, `captchaOk()` passes locally but the server rejects every call
with *"captcha protection: request disallowed"* / *"captcha required"*, and the
user sees a cryptic error with nothing to click. The reverse (client ON + server
OFF) just shows a harmless widget. So: **flip both, or neither.**

To get real keys: Cloudflare dashboard → Turnstile → add a widget for the app
domain → copy the **site key** (→ env) and **secret key** (→ Supabase dashboard).

> Local note: changing the `[auth.captcha]` block in `config.toml` only takes
> effect after `supabase stop && supabase start` (the running stack does not
> hot-reload it).

## Verification checklist (do this on staging before calling login "done")

- [ ] Custom SMTP enabled; test mail reaches a non-team address.
- [ ] Sign up a fresh corporate account → confirmation/first-login mail arrives.
- [ ] Sign up a fresh NGO account → same.
- [ ] "Forgot password" → reset mail arrives, link opens the recovery screen.
- [ ] Magic-link sign-in → link arrives and signs in.
- [ ] Create an invitation → Resend mail arrives (this already worked).
- [ ] Every link lands on the real deployed origin, not `127.0.0.1`.
- [ ] Turnstile: real site key set in env **and** real secret in the dashboard;
      the widget shows on /login and a real sign-in completes.

## Who does what

| Task | Owner |
|------|-------|
| Verify `sur.plus` domain in Resend (SPF/DKIM) | Flo (DNS) |
| Enable custom SMTP in Supabase Dashboard (staging + prod) | Flo/owner |
| Set Site URL + redirect URLs per project | Flo/owner |
| Paste the 4 branded templates per project | Flo/owner |
| Raise `email_sent` rate limit after SMTP is live | code + dashboard |
| Decide `enable_confirmations` for prod | founder call |
| Turnstile: real site key (env) + secret (dashboard) per project, in sync | Flo/owner |
| App code (`signInWithOtp`, reset, sign-up, invitation delivery) | **done** |

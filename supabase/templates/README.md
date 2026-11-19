# Supabase auth e-mail templates

The e-mails Supabase sends on sign-up, sign-in, password reset and invitation,
in sur.plus branding. Before these, every auth mail was the unstyled Supabase
default — the first thing a freshly registered NGO or company saw from us was a
template that looked like nobody's product.

## Constraints these are built under

E-mail HTML is not web HTML. No webfonts (DM Sans/DM Serif cannot load —
Georgia and Helvetica are the fallbacks, matching the app's own font stack
fallbacks), no external CSS, no flexbox: tables and inline styles only,
because Outlook renders with the Word engine. One column, 560px, dark pine
header with the wordmark (the orange dot is a colored span — images are
blocked by default in most clients, so the logo is text).

Copy is DE first, EN below — registrations are German today (all eight Tally
NGOs), but the product UI is English. Both short enough that neither reads
as an afterthought.

## How to apply (manual, Supabase dashboard)

Dashboard → project `surplus-staging` → Authentication → Emails → Templates:

| Template file        | Dashboard tab      | Subject                                            |
|----------------------|--------------------|----------------------------------------------------|
| confirm-signup.html  | Confirm signup     | Willkommen bei sur.plus — bitte E-Mail bestätigen  |
| magic-link.html      | Magic Link         | Dein Anmelde-Link für sur.plus                     |
| reset-password.html  | Reset Password     | Passwort zurücksetzen — sur.plus                   |
| invite.html          | Invite user        | Du wurdest zu sur.plus eingeladen                  |

Paste the file content into the "Message body" source view, set the subject,
save. The sender name ("sur.plus") is set separately under Authentication →
Emails → SMTP Settings → Sender name.

Variables used: `{{ .ConfirmationURL }}` only. `{{ .SiteURL }}` appears in the
footer link. Do not add `{{ .Token }}` — the link is the flow.

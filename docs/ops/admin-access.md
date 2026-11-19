# Admin access

The admin area is the same app on its own host. Nothing about it appears on the public site.

## Hosts

- Public: `https://<public host>` (sign-in, sign-up, request access). `/ops` returns 404 here.
- Admin: `https://<admin host>` serves only `/ops` (its root is the admin sign-in). Other paths redirect to `/`.
- Turn the split on by setting `SURPLUS_ADMIN_HOST` to the admin hostname (for example `admin.surpluspurpose.com`).
  Unset (local dev, preview deployments) everything is reachable from one host.
- The host must be added to the Vercel project as a domain (a `*.vercel.app` name cannot have arbitrary subdomains),
  and `https://<admin host>/ops/set-password` must be in Supabase Auth, URL Configuration, Redirect URLs.

## Accounts

- No one signs up as an admin. The super admin is seeded from `.env`, other admins are invited by the super admin.
- Seed (idempotent, also resets the password): set `SURPLUS_SUPERADMIN_EMAIL`, `SURPLUS_SUPERADMIN_PASSWORD`,
  `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local`, then `pnpm seed:superadmin`.
- `SURPLUS_SUPERADMIN_EMAIL` must also be set on the deployment: it is how the app knows who may invite admins.
- Every admin can change their password in the admin area. The super admin also sees "Invite an admin"; the invitee
  receives an email (Resend) with a link to `/ops/set-password`.

## Forgotten password

- Any admin: "Forgot password?" on the admin sign-in sends the normal reset email (same message whether or not the
  address is an admin). The link opens the reset page on the public host; afterwards sign in on the admin host.
- Super admin without email access: set a new `SURPLUS_SUPERADMIN_PASSWORD` in `apps/web/.env.local` and run
  `pnpm seed:superadmin` again (it resets the password), or set it in the Supabase SQL editor.
- An admin who lost their authenticator: remove the factor in Supabase (Authentication, Users, the user, Remove MFA
  factors); they enrol again at the next sign-in.

# Payments runbook (Stripe) 

Companies buy Seed or Tree by card; NGOs are always free. Ops can still set a
plan by hand (`set_company_plan`), which keeps working with or without Stripe.

## How it works

1. `POST /api/companies/:id/checkout` (a company member) creates a Stripe Checkout
   session and returns its URL. It changes nothing.
2. Stripe calls `POST /api/stripe/webhook`. The route verifies the signature
   (raw body, HMAC-SHA256, constant time, 5-minute window), then a paid
   `checkout.session.completed` calls `activate_company_plan_from_payment` with the
   service role. That function is idempotent per Stripe event id and only upgrades.
3. Cancellations and refunds are not automated: Ops downgrades by hand.

## Configuration (server env, never committed)

| Variable | What |
|---|---|
| `STRIPE_SECRET_KEY` | secret key (use a test-mode key on staging) |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the webhook endpoint |
| `STRIPE_PRICE_SEED`, `STRIPE_PRICE_TREE` | recurring Price ids |
| `SUPABASE_SERVICE_ROLE_KEY` | used by the webhook to activate the plan |

If any Stripe variable is missing, checkout and webhook answer 503
`payments_not_configured`: payments fail closed.

In Stripe: add a webhook endpoint `https://<app>/api/stripe/webhook` for the event
`checkout.session.completed`. The checkout success page is only a landing page;
the plan is active once the webhook has run.

# E-signature runbook (DocuSeal)

Ops can send a donation certificate for signing by both the company and the NGO.
DocuSeal collects the signatures; the signed PDF is kept in the private
`signed-documents` bucket.

## Flow

1. Ops opens **Documents**, picks a certificate whose match is completed and clicks
   *Send for e-signature* (`POST /api/signature-envelopes`). The server creates a
   DocuSeal template from the certificate HTML (a signature field per role,
   "Company" and "NGO") and a submission for the company's and the NGO's contact
   emails; DocuSeal emails both signers.
2. DocuSeal calls `POST /api/webhooks/docuseal`. **Only this webhook changes
   signature states** (viewed, signed, declined, completed, voided).
3. On `submission.completed` the signed PDF is downloaded from DocuSeal and stored;
   both parties (once verified) and Ops can open it from Documents.

## Configuration (server env, never committed)

| Variable | What |
|---|---|
| `DOCUSEAL_API_KEY` | API key (`X-Auth-Token`). Without it sending fails closed (503). |
| `DOCUSEAL_URL` | API host, default `https://api.docuseal.com` (EU: `https://api.docuseal.eu`, or your self-hosted URL) |
| `DOCUSEAL_WEBHOOK_SECRET` | value of the custom header DocuSeal sends with every webhook |
| `DOCUSEAL_WEBHOOK_HEADER` | that header's name, default `x-docuseal-secret` |
| `DOCUSEAL_FILE_HOSTS` | extra hosts the signed PDF may be fetched from (self-hosted only) |
| `SUPABASE_SERVICE_ROLE_KEY` | used to apply webhook events and store the PDF |

In DocuSeal, add a webhook to `https://<app>/api/webhooks/docuseal` for the form and
submission events, with a custom header carrying the secret. DocuSeal does not
sign its webhooks, so that shared secret is the authentication; requests without
it get 401.

## Not verified against a live account

The DocuSeal calls follow its public API documentation (template from HTML,
submission with roles, webhook events). They have been tested with mocked
responses only. Before relying on it, send one real certificate on a test account
and check: both signers receive the email, the webhook arrives, and the signed
copy appears under Documents.

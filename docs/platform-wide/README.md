# Platform-wide setup

These values belong to **this Gourmet Palace install**. Put them in `backend/.env` (or the ECS task environment). They are **not** entered on the Integrations page.

Start from `backend/.env.example`. Never commit real secrets.

## Who owns these accounts

The client owns Google Cloud, Square Developer, OpenAI, Resend, MongoDB Atlas, AWS/S3 and the domain (spec A-01). They either create the apps and send the values securely, or grant a developer temporary access to create them in **client-owned** consoles.

## Order

1. [App runtime and session](app-runtime.md) — URLs, `SESSION_SECRET`, CORS
2. [MongoDB](mongodb.md) — `MONGODB_URI`
3. [Object storage](object-storage.md) — invoices, Toast archives, raw ingest
4. [Secrets store](secrets-store.md) — where Square/Google **tokens** are stored after OAuth
5. [Google OAuth app](google-oauth.md) — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
6. [Square Developer app](square-developer-app.md) — `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_ENVIRONMENT`, `SQUARE_REDIRECT_URI`
7. [OpenAI](openai.md) — `OPENAI_API_KEY`, `OPENAI_MODEL`
8. [Outbound email](email.md) — Resend preferred, SMTP fallback
9. [Inbound invoice email](inbound-invoice-email.md) — optional webhook secret

Then seed the Owner/Admin (`npm run seed:admin`) and continue in [`../per-org/README.md`](../per-org/README.md).

## What stays out of `.env`

| Not an env var | Where it actually happens |
| --- | --- |
| Square / Google login | Per-org **Connect with OAuth** |
| Access and refresh tokens | Secrets store after OAuth |
| Restaurant ↔ Square / GA4 / GSC / GBP mapping | Integrations page |
| Toast CSV | Integrations page upload |
| Channel mapping, item aliases, backfill dates | Integrations page |

## Env vars this folder covers

```
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
SQUARE_ENVIRONMENT
SQUARE_APPLICATION_ID
SQUARE_APPLICATION_SECRET
SQUARE_REDIRECT_URI
OPENAI_API_KEY
OPENAI_MODEL
RESEND_API_KEY
RESEND_FROM
SMTP_*
INBOUND_INVOICE_SECRET
MONGODB_URI
SESSION_SECRET
SESSION_NAME
SESSION_MAX_AGE_MS
SESSION_SECURE
SECRET_ENCRYPTION_KEY
CORS_ORIGIN
APP_URL
NODE_ENV
PORT
SECRET_STORE_PROVIDER
SECRET_STORE_PREFIX
LOCAL_SECRETS_DIR
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
STORAGE_PROVIDER
LOCAL_STORAGE_DIR
S3_BUCKET
S3_REGION
S3_ENDPOINT
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_SESSION_TOKEN
S3_FORCE_PATH_STYLE
FILE_SIGNING_SECRET
SEED_ADMIN_*
SEED_ORG_*
```

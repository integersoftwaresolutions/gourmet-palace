# Deploy on Vercel

One GitHub import deploys the **Vite SPA** and the **Express API** on the same origin (`/api/v1/*` → serverless Express). Cookie sessions work without cross-site cookie tweaks.

## Import steps

1. Open [vercel.com/new](https://vercel.com/new) and import this repository.
2. Leave **Root Directory** empty (repo root). Vercel reads `vercel.json`.
3. Add the environment variables below (Production + Preview as needed).
4. Deploy.
5. After the first production URL is known, set `APP_URL` / `CORS_ORIGIN` to that URL (and custom domain if you add one), then redeploy.
6. Seed the owner account once against Atlas:

```bash
cd backend
# temporarily point MONGODB_URI (and seed vars) at the production database
npm run seed:admin
```

7. In Square / Google developer consoles, set OAuth redirect URIs to:

- `https://<your-domain>/api/v1/integrations/square/callback`
- `https://<your-domain>/api/v1/integrations/google/callback`

## Frontend env (Vercel → Environment Variables)

| Name | Required | Value |
| --- | --- | --- |
| `VITE_API_BASE` | No | `/api/v1` (default; keep this for same-origin deploy) |

Vite inlines `VITE_*` at **build** time. If you ever host the API on a different origin, set `VITE_API_BASE` to that full API prefix before building.

## Backend / serverless env (required for Production)

Copy these into the same Vercel project (they apply to `/api` functions and Cron).

### Core

| Name | Example / notes |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas SRV URI |
| `APP_URL` | `https://your-app.vercel.app` (or custom domain) |
| `CORS_ORIGIN` | Same as `APP_URL` (comma-separate extras if needed) |
| `SESSION_SECRET` | Long random string |
| `SESSION_SECURE` | `true` |
| `FILE_SIGNING_SECRET` | Long random string |
| `SECRET_ENCRYPTION_KEY` | Long random string (token encryption material) |
| `CRON_SECRET` | Long random string — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` |

### Storage + secrets (production hard requirements)

| Name | Value |
| --- | --- |
| `SECRET_STORE_PROVIDER` | `aws` |
| `SECRET_STORE_PREFIX` | `gourmet-palace` |
| `STORAGE_PROVIDER` | `s3` |
| `S3_BUCKET` | your private bucket |
| `S3_REGION` | e.g. `us-west-2` |
| `AWS_REGION` | usually same as S3 |
| `AWS_ACCESS_KEY_ID` | IAM user/key with S3 + Secrets Manager access |
| `AWS_SECRET_ACCESS_KEY` | matching secret |

Optional if keys differ for S3: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`.

### Email / AI / OAuth

| Name | Notes |
| --- | --- |
| `RESEND_API_KEY` | Preferred mail |
| `RESEND_FROM` | Verified sender |
| `OPENAI_API_KEY` | Server-side only |
| `OPENAI_MODEL` | e.g. `gpt-5-mini` |
| `SQUARE_ENVIRONMENT` | `sandbox` or `production` |
| `SQUARE_APPLICATION_ID` | |
| `SQUARE_APPLICATION_SECRET` | |
| `SQUARE_REDIRECT_URI` | `https://<domain>/api/v1/integrations/square/callback` |
| `GOOGLE_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | |
| `GOOGLE_REDIRECT_URI` | `https://<domain>/api/v1/integrations/google/callback` |

### Optional seed defaults (used only when you run `seed:admin` locally)

`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_ORG_NAME`, `SEED_ORG_SLUG`, `SEED_LOCATIONS_JSON`

## Worker / Cron

`vercel.json` registers Cron → `GET /api/v1/system/worker/tick` (daily `0 8 * * *` for Hobby-plan compatibility).

- Set `CRON_SECRET` in Vercel.
- On **Pro**, you can change the schedule in `vercel.json` to `*/5 * * * *` to match the local worker cadence.
- Or call the same URL from an external scheduler with header `Authorization: Bearer <CRON_SECRET>`.

## Smoke checks after deploy

- `https://<domain>/` — UI loads
- `https://<domain>/api/v1/health` — `{ success: true, ... }`
- `https://<domain>/api/v1/health/ready` — Mongo connected
- Sign-in with the seeded owner

## Limits to know

- Vercel function timeout defaults to 60s here (`maxDuration`). Long Square backfills may need smaller date windows or a non-serverless worker host.
- Request body size is capped by the Vercel plan (large Toast/invoice uploads may need direct-to-S3 or a container API later).
- Local filesystem storage is not available on Vercel; production must use S3 + AWS Secrets Manager as above.

## Local development

Unchanged: run `backend` + `frontend` (+ optional `worker`) as in the root README. Do not rely on `vercel dev` unless you intentionally want the serverless shape locally.

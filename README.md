# Gourmet Palace Command Center

Production-oriented V1 implementation of the Gourmet Palace business/functional specification. The React/Vite frontend and Express API deploy together on Vercel. MongoDB Atlas is the canonical database and also provides durable provider-secret storage plus GridFS private blob storage, so no always-on worker, ECS service, Redis instance, S3 bucket, or writable server filesystem is required for the Vercel-only path.

## Repository

- `frontend/` — React 19 + Vite UI.
- `backend/` — Express API, MongoDB models/services, provider adapters, auth/RBAC, deterministic analytics, daily scheduler and workflows.

## Local setup

Requirements: Node.js 22 recommended (18+ supported by backend) and MongoDB.

```bash
cd backend
cp .env.example .env
npm ci
npm run seed:admin
npm run dev
```

In another terminal:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

There is **no standalone worker process**. For local operational testing, call the authenticated cron endpoint with `CRON_SECRET`, or use Administration → Integrations → **Sync selected data now**.

## Vercel-only schedule

The application has one logical daily operation:

`5:00 AM America/Los_Angeles → Square + Google (GA4/GSC/GBP/reviews) → analytics/forecast rebuilds → alerts → Morning Brief + email`

Vercel cron expressions are UTC, while Pacific time switches between PDT and PST. `vercel.json` therefore contains two daily UTC triggers (12:00 and 13:00 UTC) pointing to the **same** `/api/v1/system/cron/daily` endpoint. A DST-aware guard performs provider work only when the invocation is actually in the 5 AM Pacific hour; the other invocation exits immediately. This preserves one logical daily job without an hourly scheduler or separate worker.

Hourly Google review syncing has been removed. Reviews refresh in the 5 AM daily run and in manual Google/all-source refreshes.

## Manual refresh

Administration → Integrations includes **Sync selected data now**. It refreshes the selected active location(s) without cron or a worker. Square and Google run independently; one provider failure is returned as a partial result rather than hiding successful sources. Provider locks prevent overlap with the daily job, and manual cooldowns protect the external APIs.

The Morning Brief page still provides **Generate / refresh** for admins. Historical Google/Square backfills and Toast import remain manual-only.

## Required Vercel environment variables

Copy `.env.vercel.example` into Vercel Project Settings → Environment Variables and replace every placeholder. At minimum, configure MongoDB, session/encryption/signing secrets, OAuth credentials, `CRON_SECRET`, and an email provider if Morning Brief email delivery is required.

Do **not** commit `.env`, `.env.production`, OAuth tokens, or the old `backend/storage/` directory.

## Validation

```bash
cd backend
npm test
find src -name '*.js' -print0 | xargs -0 -n1 node --check

cd ../frontend
npm run build
npm run lint
```

Live provider acceptance still requires the client-owned Square/Google accounts, correct per-location mappings, MongoDB Atlas network access from Vercel, and valid email credentials.

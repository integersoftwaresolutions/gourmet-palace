# Gourmet Palace Command Center

Production-oriented V1 implementation of the Gourmet Palace business/functional specification. The existing Vite/React design system is retained; the application is backed by an Express API, MongoDB Atlas canonical model, scheduled worker, private object storage, controlled OpenAI tools, Square live POS, Toast historical import, and Google data adapters.

The authoritative requirement baseline is `docs/Gourmet_Palace_Combined_Business_Functional_Technical_Specification_v1.2_Final.md` (also mirrored as `docs/requirement.md`).

## Repository

- `frontend/` — React 19 + Vite + Tailwind UI. Production business pages call the backend for canonical data.
- `backend/` — Express API, MongoDB models/services, provider adapters, worker, auth/RBAC, deterministic analytics and workflows.
- `docs/` — final specification, implementation notes, UAT checklist, deployment guide and operational runbook. Credential and Integrations setup is split in [`docs/SETUP.md`](docs/SETUP.md) (`docs/platform-wide/` vs `docs/per-org/`).

## Local setup

Requirements: Node.js 22 recommended (18+ supported by backend) and MongoDB.

```bash
cd backend
cp .env.example .env
# Configure MONGODB_URI, SESSION_SECRET and development credentials as needed.
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

In a third terminal run the scheduled worker when testing daily ingestion/brief behavior:

```bash
cd backend
npm run worker
```

The Vite dev server proxies `/api` to `http://localhost:4000`. There is no public registration flow. Use `npm run seed:admin` to provision the initial Owner/Admin account, then create Managers through Administration.

Dashboards use canonical POS and Google data only. Connect Square (and Google) in Administration → Integrations, then backfill or wait for the daily worker. Empty days are labeled Unavailable, not filled with sample numbers.

## Validation

```bash
cd backend
npm test
find src -name '*.js' -print0 | xargs -0 -n1 node --check

cd ../frontend
npm run build
npm run lint
```

CI repeats those checks on pushes/PRs. Live provider acceptance still requires client-owned Square/Google/OpenAI/Resend/AWS/MongoDB credentials and representative data; see `docs/UAT_CHECKLIST.md`.

## Deploy on Vercel (recommended quick path)

Import this GitHub repo into Vercel with **Root Directory left empty**. The root `vercel.json` builds `frontend/` and serves the Express API at `/api/*` on the same origin.

1. Copy variables from [`.env.vercel.example`](.env.vercel.example) into the Vercel project env settings.
2. Deploy, then set `APP_URL` / `CORS_ORIGIN` / OAuth redirect URIs to the real URL and redeploy.
3. Seed the owner once: `cd backend && MONGODB_URI=... npm run seed:admin`.

Full checklist: [`docs/DEPLOYMENT_VERCEL.md`](docs/DEPLOYMENT_VERCEL.md).

## Production target (AWS / containers)

For long-running API + 5-minute worker at scale:

- frontend: S3 + CloudFront (or Vercel),
- API: ECS/Fargate,
- worker: separate ECS/Fargate service with desired count **1**,
- database: MongoDB Atlas with Cloud Backup/PITR,
- files/archive: private versioned S3 bucket,
- provider OAuth tokens: AWS Secrets Manager,
- email: Resend (SMTP fallback for development),
- telemetry: CloudWatch + Atlas + Resend delivery events.

Use ECS task roles rather than long-lived AWS keys. See `docs/DEPLOYMENT_AWS.md` and `docs/RUNBOOK.md`.
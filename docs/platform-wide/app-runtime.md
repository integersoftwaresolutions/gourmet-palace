# App runtime, session, CORS (platform)

Makes the API, frontend, cookies, and OAuth callbacks work together.

## Env vars

| Variable | Local typical | Production |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `4000` | as the platform assigns |
| `APP_URL` | `http://localhost:5173` | public frontend origin, no trailing slash |
| `CORS_ORIGIN` | `http://localhost:5173` | **exact** frontend origin. Never `*` with sessions |
| `SESSION_SECRET` | long random | **required**, different from other secrets |
| `SESSION_NAME` | `gp.sid` | optional |
| `SESSION_MAX_AGE_MS` | `604800000` (7 days) | as agreed |
| `SESSION_SECURE` | `false` | `true` (HTTPS) |
| `SEED_*` | see [mongodb.md](mongodb.md) | change before go-live |

Frontend (`frontend/.env` / `.env.local`):

```
VITE_API_BASE=/api/v1
```

Local Vite proxies `/api` to `http://localhost:4000`. Production should keep the browser on the same registrable domain as the API when possible (`app.example.com` + `api.example.com`).

## Why this matters for integrations

OAuth callbacks are **authenticated** Owner/Admin routes:

- Google: `GET /api/v1/integrations/google/callback`
- Square: `GET /api/v1/integrations/square/callback`

The browser must send the session cookie on the redirect back to the API. Wrong `APP_URL`, `CORS_ORIGIN`, or `SESSION_SECURE` shows up as “Invalid or expired OAuth state” or a bounce to login.

After success the API redirects to:

`{APP_URL}/admin/integrations?connected=google` or `?connected=square`

## Step by step

1. Generate `SESSION_SECRET`, `SECRET_ENCRYPTION_KEY`, and `FILE_SIGNING_SECRET` as **three different** random values.
2. Set `APP_URL` and `CORS_ORIGIN` to the real frontend origin.
3. Production: `NODE_ENV=production`, `SESSION_SECURE=true`.
4. Confirm API health: `GET /api/v1/health/ready`.
5. Sign in, then test Google/Square connect.

## Checklist

- [ ] `APP_URL` and `CORS_ORIGIN` match the frontend origin exactly
- [ ] Strong unique `SESSION_SECRET`
- [ ] Production HTTPS + `SESSION_SECURE=true`
- [ ] OAuth redirect URIs still point at the API `/api/v1/integrations/.../callback`

# Gourmet Palace Backend

## Vercel-only execution model

The backend is an Express service deployed as a Vercel Function. It does not require or support an always-on queue worker for normal operation.

### Daily schedule

One logical operation runs at 5:00 AM `America/Los_Angeles`:

1. Resolve the prior completed business date.
2. For every active location, refresh Square and Google concurrently.
3. Google refresh includes GA4, Search Console, GBP performance and GBP reviews.
4. Square canonicalization rebuilds DailyMetric, baselines/location score and forecast.
5. Evaluate location alerts after provider refresh.
6. After all locations settle, generate the company/manager Morning Brief snapshots and email configured recipients.
7. Record every execution and partial/failure state in `JobRun` for Admin → Job logs.

`vercel.json` has daily 12:00 and 13:00 UTC triggers to the same endpoint. The endpoint checks `America/Los_Angeles` and exits unless the local hour is 5. This is required to remain correct through PDT/PST without an hourly scheduler.

### Failure behavior

Provider failures are isolated by source and location. A Square failure does not suppress Google, and a Google sub-source failure does not discard successful Google sources. Alerts are attempted after provider work. Morning Brief publication still occurs with a PARTIAL evidence status when one or more mapped sources are incomplete. No sample data is synthesized.

The daily operation and per-location refreshes are idempotent by Pacific date. Stale leases can be reclaimed. Provider HTTP calls have bounded timeouts. Google and Square have per-location locks; manual requests also have cooldowns.

### Manual refresh

`POST /api/v1/integrations/sync-now` is admin-authenticated and refreshes Square + Google + reviews + alerts for one location. The UI runs it for each selected active location and reports complete/partial/failed results. Historical backfills remain explicit manual actions.

### Cron authentication

Set `CRON_SECRET` in Vercel. Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>`. The same endpoint accepts `x-cron-secret` for an authenticated operational retry.

- `GET /api/v1/system/cron/daily` — scheduled, executes only during 5 AM Pacific.
- `POST /api/v1/system/cron/daily` — authenticated operational retry; bypasses the hour guard but remains idempotent.

### Durable Vercel persistence

Vercel local disk is ephemeral. Therefore the Vercel defaults are:

- `SECRET_STORE_PROVIDER=mongo`: OAuth token payloads are AES-256-GCM encrypted with `SECRET_ENCRYPTION_KEY` and stored in the provider `Connection` row.
- `STORAGE_PROVIDER=mongo`: private invoices/raw ingest/Toast archives are stored in MongoDB GridFS.

AWS Secrets Manager and S3 remain supported when explicitly configured, but they are not required for the Vercel-only deployment.

### Important deployment prerequisites

- MongoDB Atlas must permit connections from Vercel and `MONGODB_URI` must be set.
- `SESSION_SECRET`, `SECRET_ENCRYPTION_KEY`, `FILE_SIGNING_SECRET`, and `CRON_SECRET` must be stable strong values.
- Square/Google OAuth redirect URIs must use the deployed Vercel domain.
- Resend or SMTP must be configured if actual Morning Brief email delivery is required.
- Existing integrations whose `secretRef` points to `local-secret:` must be reconnected once after deployment unless those secrets were migrated separately; new connections are durable in MongoDB.

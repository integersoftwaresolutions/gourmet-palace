# AWS Production Deployment

## Target topology

1. Build `frontend/` and publish `dist/` to a private S3 origin behind CloudFront. Configure SPA fallback to `index.html` and TLS/domain through the client-owned AWS/Cloudflare setup.
2. Build `backend/Dockerfile` and push to ECR.
3. Run the image as an ECS/Fargate **API service** with command `node src/server.js`, ALB health path `/api/v1/health/ready` and at least two API tasks where budget permits.
4. Run the same image as a separate ECS/Fargate **worker service** with command `node src/worker.js` and desired count **1**. The app also persists source/date idempotency state in MongoDB.
5. Use MongoDB Atlas production with network access limited to the application path, Cloud Backup + point-in-time recovery enabled on the selected plan.
6. Use a private, versioned S3 bucket for invoice originals/derived files/Toast archives. Block public access.
7. Use AWS Secrets Manager for Square/Google OAuth token material. MongoDB contains only the corresponding reference.
8. Configure Resend with the client-owned verified domain for application mail.

## ECS task-role permissions

Prefer task roles; do not place long-lived AWS access keys in application environment variables. The API/worker task role needs only the applicable resources, for example:

- `secretsmanager:GetSecretValue`, `CreateSecret`, `PutSecretValue` for `gourmet-palace/production/*`,
- `s3:GetObject`, `s3:PutObject` for the private Gourmet Palace object prefix/bucket,
- normal ECS/CloudWatch log permissions provided by the execution role.

The supplied signer obtains ECS task-role credentials through the container credential endpoint. Explicit AWS/S3 keys remain optional local/custom-S3 fallbacks only.

## Required production environment

Start from `backend/.env.example`. At minimum configure strong `SESSION_SECRET`, `FILE_SIGNING_SECRET`, MongoDB URI, app/CORS URLs, `SECRET_STORE_PROVIDER=aws`, `STORAGE_PROVIDER=s3`, S3 bucket/region, Square OAuth app values, Google OAuth app values, OpenAI key/model and Resend key/from domain. Set `SESSION_SECURE=true` and `NODE_ENV=production`.

Keep frontend and API under the same registrable domain when possible (for example `app.example.com` and `api.example.com`). Configure the exact frontend origin in `CORS_ORIGIN`; do not use `*` with credentialed sessions.

## Release sequence

1. Run CI and create staging image/build.
2. Run database/index initialization through normal application startup/seed procedures; never point a local demo seed at production.
3. Deploy API, confirm liveness/readiness, then worker.
4. Connect Square/Google through the Admin UI and explicitly map canonical locations/resources.
5. Import/archive Toast history, run Square backfill in bounded windows and validate reconciliation.
6. Approve final Square channel mapping only after representative sample validation.
7. Configure location targets/thresholds/notification recipients.
8. Run UAT including a simulated delayed provider and Partial→Complete brief revision.
9. Verify Atlas backup/PITR and S3 versioning/retention; execute a staging restore.
10. Cut over production frontend/domain, observe three live Square cycles, then record acceptance.

## Rollback

Keep the prior ECR image tag and frontend S3/CloudFront release. Roll API/worker back together when domain/data-contract changes are involved. Canonical source facts are upserted by provider IDs and calculations are versioned/rebuildable; do not manually delete raw/canonical history as a rollback strategy.

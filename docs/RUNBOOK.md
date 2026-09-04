# Gourmet Palace Operations Runbook

## Provider outage or revoked credentials

1. Check Administration → System Health for connector/job state and last success.
2. Do not treat missing data as zero. Business alerts dependent on incomplete data must remain suppressed.
3. Re-authorize the provider through Admin Integrations if credentials are revoked; tokens are stored in the managed secret store.
4. Use the Admin re-run action for the exact source/location/business date after access returns.
5. Confirm reconciliation before considering the day complete.
6. If the 5 AM brief was Partial, verify a newer current revision appears after the recovered source completes; keep the earlier revision.

## Failed Square import/backfill

- inspect JobRun error/attempt count,
- correct entitlement/mapping/rate-limit issue,
- re-run the same source/location/date; provider-order upserts and job idempotency prevent duplicate canonical orders,
- verify order count exact match, net sales within ±0.5% or $5, and refund/void/discount within ±1% or $3 where controls are available.

## Toast historical import

Never edit the supplied source export before archive. The import stores the original bytes first, then parses canonical data. If parsing/mapping needs correction, retain the same archived source and reprocess through a versioned/corrected mapping procedure; do not convert Toast into a live connector.

## OCR backlog/failure

- originals remain private even if OCR fails,
- failed invoices can be retried/resubmitted; they do not affect reporting,
- PENDING_REVIEW requires human correction/confirmation,
- invoice number/date/total must be explicitly confirmed before approval,
- duplicate candidates require disposition,
- assess OCR acceptance against the client-provided real-invoice sample set; do not infer >=90% from synthetic/demo data.

## Failed Morning Brief/email

The deterministic brief should remain available even when AI/email fails. Check the Brief record `emailStatus`, Resend delivery events, source coverage and worker logs. Repair delivery/configuration, but never rewrite an already published immutable revision. A source-data recovery creates a newer revision.

## Backup/restore

- MongoDB: use Atlas Cloud Backup/PITR on the selected production tier. At least once before handover, restore production-like backup into isolated staging and verify users/config/canonical history/workflows.
- Private files: enable S3 versioning/retention. Validate recovery of an invoice original and the unchanged Toast archive.
- Full client export: Administration → System Health exposes portable canonical JSON. Private originals are exported/recovered separately from the client-owned S3 bucket so secrets or internal signed links are not embedded in the JSON export.

## Data correction principles

Do not manually overwrite published aggregate truth to make a dashboard look correct. Fix provider mapping/source data or approved workflow state, then re-run the deterministic calculation path. Preserve audit history and immutable source provenance.

## Handover/access removal

At delivery, rotate/remove delivery-team IAM, Atlas, Square, Google, OpenAI, Resend and domain access unless continued support is explicitly authorized. Client accounts and data remain client-owned.

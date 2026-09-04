# Gourmet Palace V1 Delivery Status

## Repository state

Implementation is left in the supplied Git working tree. No commit, push, reset, rebase or history rewrite is performed as part of delivery. The final v1.2 specification in this repository is the authoritative requirement baseline.

## Implemented application scope

The working tree contains the V1 web application, Express API, MongoDB canonical model, authentication/RBAC/location isolation, Square live adapter/backfill/reconciliation, Toast historical import/archive, Google adapters, deterministic analytics/score/baseline/forecast services, fixed alerts, Morning Brief revisions, Reporting Center/CSV/browser print, controlled read-only AI, invoice OCR/human approval, vendor price intelligence, manual inventory, audit/system health, private storage, secret-store abstraction, Resend/SMTP mail, deployment files and operational/UAT documentation.

Production pages use backend APIs and canonical provider data rather than restaurant showcase datasets.

## Offline validation performed in this workspace

The execution environment could not restore npm packages from the registry, so a clean dependency-installed Vite build cannot be truthfully claimed here. The repository was instead validated using the dependency-independent checks available in the environment:

- Node parser validation across **104 backend JavaScript source/test files with zero syntax errors**,
- Node built-in tests (**11/11 passing**) covering authorization scope, date ranges, 4:00 AM business cutoff, reconciliation tolerances, bounded comparable-history trend calculation and sales-weighted health,
- TypeScript `transpileModule` syntax diagnostics across **61 frontend `.ts`/`.tsx` files with zero syntax diagnostics** using the globally installed compiler,
- relative-import resolution scan across backend/frontend source (**zero missing relative imports**),
- source sweep for production mock/canned restaurant datasets and placeholder business actions.

Run `npm ci && npm test` in `backend/`, and `npm ci && npm run build && npm run lint` in `frontend/` on a machine with registry access before pushing. GitHub Actions contains the same clean-install/build/test checks.

## Live acceptance still requiring client-owned accounts/data

These are external UAT conditions, not code placeholders: three reconciled live Square cycles; final Square channel mapping against representative production data; Google property/location/API availability; OCR accuracy measurement on the client's real invoice sample set; actual 5:00 AM Pacific provider/email latency; and a production Atlas/S3 backup-restore exercise. See `UAT_CHECKLIST.md`.

# Gourmet Palace V1 Implementation Notes

## Source of truth

The V1.2 Final specification in this repository governs behavior. The previous repository requirement file was stale (it described Toast as live); it has been replaced with the supplied final V1.2 baseline. Square is the only live V1 POS. Toast is a one-time historical import whose original file is archived unchanged before parsing.

## Application boundaries

The implementation keeps the existing React/Vite frontend and Express API. Business truth is calculated server-side. Controllers/routes validate HTTP inputs; scoped services/repositories enforce organization/location authorization; deterministic analytics calculate monetary/KPI truth; OpenAI can only narrate controlled results or extract invoice candidates.

### Authentication and authorization

- email/password only; no public registration/social sign-in,
- adaptive password hashing and HTTP-only Mongo-backed sessions,
- time-limited single-use activation/reset tokens,
- Owner/Admin vs Manager role/location scope enforced by the API,
- Finance, Reporting Center, SEO/Google review workflows restricted to Owner/Admin,
- object/file access requires both an authenticated authorized record lookup and an expiring HMAC URL.

### Canonical business data

MongoDB stores canonical organization/location-scoped orders, daily metrics, scores, baselines, forecasts, invoices/items, vendors/price observations, manual inventory/history, reviews, SEO metrics, alerts, brief revisions, chats/tool evidence, audits and job runs. Money is kept in integer minor units.

Where Square and Toast overlap, Square is authoritative for the live day. Toast facts remain preserved for provenance and historical reprocessing rather than being double-counted.

### Provider integrations

- **Square:** OAuth, location discovery/mapping, orders sync/backfill, resumable idempotent job tracking, reconciliation controls, optional catalog/category enrichment and explicitly approved channel mapping. Direct-online metrics remain unavailable until the channel mapping is approved.
- **Toast:** historical CSV import only; original bytes are stored first in private object storage, then canonical rows are upserted with Toast provenance.
- **Google:** OAuth and discovery for GA4, Search Console and GBP; mapped syncs persist analytics/search/GBP performance/reviews independently so one unavailable capability does not fabricate another.
- **Secrets:** provider OAuth tokens are stored in AWS Secrets Manager in production; MongoDB stores only `secretRef` plus non-secret connection metadata. Development uses encrypted local secret files.

### Analytics and trust labels

- configurable location score weights with proportional redistribution when a component is unavailable,
- net-sales-weighted Business Health Score with weighted score coverage and same-weekday prior-comparable change,
- comparable weekday baselines (8 target / 4 provisional minimum) using a robust median plus a documented ±10% bounded recent-trend factor,
- weekly forecasting using the same comparable-weekday/recent-trend principle with expected range, coverage/status and formula version,
- exact/partial/unavailable data states and source freshness,
- finance labels purchase-based food cost as an estimate and selected-margin profit as a planning estimate.

### Workflows

- fixed alert catalogue, per-location versioned thresholds, cooldown/dedup, assignment/notes/lifecycle and scoped notifications,
- Morning Brief immutable revisions with Partial→new-current revision behavior,
- invoice PDF/JPG/PNG/inbound-email intake, private originals, OCR evidence/confidence, duplicates, human confirmation and approval gating,
- reusable approved invoice corrections and vendor price observations,
- manual inventory counts/history, CSV import/export, bulk update, copy-previous, stale/critical states,
- Google review draft/edit→approve→explicit post flow,
- Owner/Admin Reporting Center with CSV/browser-print output,
- six-family controlled read-only Ask-the-AI service with authorization, evidence and insufficiency handling.

## External acceptance boundary

The software can be configuration-complete without live client credentials, but the following cannot be truthfully certified offline:

- Square historical reconciliation against the client account and three successful live production cycles,
- final client-approved Square channel mapping against representative data,
- Google property/location availability and API history for the client account,
- OCR >=90% evaluation on the client's real invoice sample set,
- actual 5:00 AM Pacific provider-latency behavior and outbound-domain delivery,
- production backup restore on the client-selected Atlas/S3 plans.

Those are covered by `UAT_CHECKLIST.md` and must be executed after credentials/data are supplied.

# Per-organization setup

These steps are for **this Gourmet Palace organization** (the restaurant group). They are done in the product while signed in as Owner/Admin. Nothing here goes in `.env`.

V1 has one org. The database still stores connections by `organizationId`, so a future extra org would repeat this folder rather than sharing tokens.

Prerequisite: platform env is already set ([`../platform-wide/README.md`](../platform-wide/README.md)) and you can sign in.

Screen: **Administration → Integrations** (`/admin/integrations`) unless another path is named. GA4, Search Console, and Business Profile are created in Google’s products first; Gourmet Palace only OAuth-connects and maps them.

## Order

1. [Create locations](locations.md)
2. [Google Analytics 4 property](google-analytics-4.md) — create or reuse; grant the connecting user access
3. [Google Search Console property](google-search-console.md) — create or reuse; verify; grant access
4. [Google Business Profile listings](google-business-profile.md) — People and access on each restaurant
5. [Connect Square OAuth](connect-square.md)
6. [Connect Google OAuth](connect-google.md) — one login covers GA4 + Search Console + GBP
7. [Map each restaurant to Square / GA4 / GSC / GBP](map-locations.md)
8. [Square channel mapping](square-channel-mapping.md) — save draft first; **approve only after sample validation**
9. [Item aliases](item-aliases.md) — optional; approve only when matches are certain
10. [Toast historical CSV](toast-historical-import.md)
11. [Square historical backfill](square-backfill.md)
12. [Business targets and alert recipients](business-targets.md)
13. [Inventory starter list](inventory-setup.md)
14. [Invoices, vendors, OCR samples](invoice-vendor-setup.md)

Where Square and Toast overlap on the same day, Square is the live source of truth. Toast remains labeled historical.

## What the client still brings to this folder

| Bring | Used in |
| --- | --- |
| Square owner available ~10 minutes | Connect Square |
| Existing or new GA4 / Search Console / GBP + access for the connecting Google user | [GA4](google-analytics-4.md), [Search Console](google-search-console.md), [Business Profile](google-business-profile.md), then Connect Google |
| Which Square location / GA4 / site / GBP is which restaurant | Map locations |
| How dine-in, takeout, delivery, third-party, website orders appear in Square | Channel mapping |
| Original Toast CSV (12+ months if possible), unedited | Toast import |
| Approved Square backfill date range | Backfill |
| Item name/ID pairs that should be treated as one dish | Item aliases |
| Food-cost % range, selected margin, who gets alert email | Targets |
| 30–50 core inventory items per location | Inventory |
| Sample invoices and vendor names | Invoices |

They do **not** send Square or Google passwords.

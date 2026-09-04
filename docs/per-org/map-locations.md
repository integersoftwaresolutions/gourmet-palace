# Map restaurants to Square and Google (per org)

Tells Gourmet Palace which provider location is which canonical restaurant.

## Where

**Administration → Integrations → Canonical location mappings**

Create locations first. The client’s GA4 / Search Console / GBP properties must already exist and be visible to the connecting Google user ([GA4](google-analytics-4.md), [Search Console](google-search-console.md), [Business Profile](google-business-profile.md)). Then Connect Square and Google and click **Refresh resources** so dropdowns have data.

## What to collect from the client

A table they confirm, for example:

| Gourmet Palace location | Square restaurant | GA4 property | Search Console site | Google Business Profile |
| --- | --- | --- | --- | --- |
| Downtown | Downtown | Gourmet Palace Main | `sc-domain:gourmetpalace.com` | Gourmet Palace Downtown |

It is valid for several restaurants to share one GA4 or one website. Document that; do not guess.

## Step by step

For each **active** location row:

1. **Square restaurant** — pick the Square location id. Required before Square sync/backfill for that site.
2. **GA4 property** — pick the discovered property.
3. **Search Console site** — pick the exact `siteUrl` (domain or URL-prefix).
4. **GBP location** — pick the listing. The UI also stores the GBP account id needed for reviews.

Each dropdown saves on change.

Do not type these ids into `.env`.

## If a dropdown is empty

- Square empty → not connected, or Refresh resources not run
- Google empty → Connect/Refresh failed for that API, or the Google user cannot see that asset

Leave a mapping blank rather than picking the wrong property. Unmapped Google sources stay Unavailable for that location.

## Checklist

- [ ] Every active restaurant has the Square location it actually uses
- [ ] GA4 / GSC / GBP mapped only where the client confirmed
- [ ] Shared websites/properties are intentional

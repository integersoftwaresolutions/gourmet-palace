# Connect Google OAuth (per org)

Authorizes **this org** to read GA4, Search Console, and Google Business Profile, and to post **approved** review replies.

One OAuth connect covers all three. The properties themselves are set up first:

- [`google-analytics-4.md`](google-analytics-4.md)
- [`google-search-console.md`](google-search-console.md)
- [`google-business-profile.md`](google-business-profile.md)

Platform Cloud OAuth app must already exist: [`../platform-wide/google-oauth.md`](../platform-wide/google-oauth.md).

## Where

**Administration → Integrations → Google · GA4 / Search Console / Business Profile → Connect with OAuth**

Only Owner/Admin. Google is asked for `access_type=offline` and `prompt=consent` so a refresh token is issued. Use the Google account that already has access to **all** required properties.

## What to collect from the client

- The Google account email that should click Connect
- Confirmation that account can see:
  - every needed **GA4 property**
  - every needed **Search Console** site (`sc-domain:…` or `https://…`)
  - every needed **Business Profile** location
- If the Cloud OAuth app is in Testing, that email must be a **test user**

They must **not** give you the Google password.

You do **not** need them to paste Property IDs into env. After Connect, **Refresh resources** fills the mapping dropdowns.

## Step by step

1. Confirm `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` are set.
2. Confirm APIs are enabled, including Analytics **Admin** API and Google My Business API.
3. Sign into Gourmet Palace as Owner/Admin.
4. Click **Connect with OAuth** on the Google card.
5. Choose the client Google account. Grant all requested scopes. Do not skip Business Profile if reviews/GBP are in scope.
6. Land on `/admin/integrations?connected=google`.
7. Click **Refresh resources**.
8. Open **Canonical location mappings** and confirm GA4 / Search Console / GBP dropdowns are populated.

If one API fails, others still work. Status **PARTIAL** with an error JSON on the card is expected when one capability is missing. The app will not invent zeros for the missing source.

## Common failures

| Symptom | Likely cause |
| --- | --- |
| `503 Google OAuth is not configured` | Platform env missing |
| Redirect mismatch | Console URI ≠ `GOOGLE_REDIRECT_URI` (must include `/api/v1`) |
| `access_denied` / app not verified | Testing mode without that user as test user |
| Empty GA4 dropdown | Analytics Admin API off, or the Google user lacks GA4 access |
| Empty GSC dropdown | Search Console API off, or user is not a user on the property |
| Empty GBP dropdown | Business Profile APIs off, or user not on the listing |
| Reviews fail later | Google My Business API (v4) not enabled, or GBP not mapped with account + location |

## Checklist

- [ ] Connecting Google user has GA4, GSC, and GBP access
- [ ] OAuth completed in the product
- [ ] Refresh resources lists the client’s properties
- [ ] Missing capabilities show Partial/Unavailable, not fake zeros

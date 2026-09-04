# Google Business Profile (per org)

Each restaurant listing is a **Business Profile**, not a platform env var. There is no `GBP_LOCATION_ID` in `.env`.

This is the Accounts.MD GBP access guide, kept here because listings belong to the client. Gourmet Palace discovers accounts/locations the connecting user can manage, then you map each Gourmet Palace location to a listing. That mapping also stores the GBP **account** id required to list and reply to reviews.

| V1 uses GBP for | API (enabled on the Cloud project) |
| --- | --- |
| Listing discovery | My Business Account Management + Business Information |
| Maps / search / website / call / directions metrics | Business Profile Performance |
| Google reviews + posting **approved** replies | Google My Business API (v4) |

Review replies always need Owner/Admin edit → approve → explicit post in the product. OAuth scope `business.manage` is why reply posting is possible.

## What to collect from the client

- Every physical restaurant’s Business Profile (name as it appears in Google)
- A Google account that is **Owner or Manager** on **each** listing (Manager must be allowed to reply if they want posting)
- Which Gourmet Palace location row is which listing

If they have no listing, they must create it in Google Business Profile first. This app cannot invent a listing.

## Step by step — access

1. Open [Google Business Profile](https://business.google.com/) (menu labels move; look for the location list / Maps listing manager).
2. For **each** restaurant:
   1. Select the listing.
   2. Open **Business Profile settings** (or **People and access** / managers).
   3. Confirm the integration Google account is listed.
   4. If missing, invite that email and have them accept.
3. Repeat until every location Gourmet Palace will report on is covered.

The same Google account should later click **Connect with OAuth** so discovery sees every listing (the API walks up to 20 GBP accounts).

If Business Profile APIs do not enable on the Cloud project, request GBP API access for that project (see [`../platform-wide/google-oauth.md`](../platform-wide/google-oauth.md)), then retry.

## After access exists

1. Connect Google: [`connect-google.md`](connect-google.md).
2. **Refresh resources**. Listings fill the **GBP location** dropdown.
3. Map each restaurant: [`map-locations.md`](map-locations.md). Picking a listing also saves `gbpAccount`, which reviews need.

Leave GBP unmapped rather than attaching the wrong store. That location’s GBP metrics and Google reviews stay Unavailable.

## Checklist

- [ ] Each restaurant has a real Business Profile
- [ ] Integration Google user is Owner/Manager on every needed listing
- [ ] Cloud project has the four Business Profile / My Business APIs enabled
- [ ] Mapped on Integrations after OAuth — not stored in `.env`
- [ ] Reply posting tested only after a draft is approved in-app

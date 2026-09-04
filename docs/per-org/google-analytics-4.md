# Google Analytics 4 (per org)

GA4 is a **restaurant Google property**, not a platform env var. There is no `GA4_PROPERTY_ID` in `.env`.

This file is the Accounts.MD “create / find GA4” guide, kept here because it belongs to the client’s Analytics account. After the property exists and the connecting user can see it, Gourmet Palace **discovers** it through OAuth and you pick it on Integrations.

| This is | That is not |
| --- | --- |
| analytics.google.com property for the website | `GOOGLE_CLIENT_ID` in [`../platform-wide/google-oauth.md`](../platform-wide/google-oauth.md) |
| Numeric Property ID (`123456789`) | Measurement ID (`G-XXXXXXXXXX`) used only on the website tag |

V1 reads **sessions**, **totalUsers**, and **keyEvents** for the mapped property. One unavailable Google source does not zero the others.

## What to collect from the client

- Whether they **already have GA4** (use it; do not create a duplicate)
- Property **name** and which restaurant(s) it covers
- Google account that should later click **Connect with OAuth** (needs at least Viewer on the property)

You do **not** paste the Property ID into env. You may record it so mapping is unambiguous.

## Option A — GA4 already exists (preferred)

1. Open [Google Analytics](https://analytics.google.com/).
2. Switch to the existing property. Do not create a new one or history is split.
3. **Admin → Property access management**.
4. Add the integration Google account. **Viewer** is enough to read.
5. **Admin → Property settings / Property details**. Copy the numeric **Property ID**.

Do not confuse:

| ID | Example | Used for |
| --- | --- | --- |
| Property ID | `123456789` | API / Integrations mapping |
| Measurement ID | `G-XXXXXXXXXX` | Website tracking snippet only |

## Option B — starting GA4 from zero

Only if they have no property.

1. Open [Google Analytics](https://analytics.google.com/) → start account/property setup.
2. **Account name:** business name, for example `Gourmet Palace`.
3. Set account data sharing as they prefer → **Next**.
4. **Property name:** for example `Gourmet Palace` or a per-location name if they will have several properties.
5. Reporting **timezone** and **currency** (should match the restaurant).
6. Industry: closest restaurant / food category. Business size as applicable.
7. Objectives such as understand traffic, user behavior, measure performance.
8. Accept Analytics terms.
9. **Data collection → Web**. Website URL, for example `https://www.gourmetpalace.com`. Stream name, for example `Gourmet Palace Website`.
10. Create stream. Google shows Measurement ID `G-XXXXXXXXXX` and a stream ID.
11. Install the Google tag on the **website**. New data only starts after the tag is live. Historical Analytics cannot appear if they never had GA4.
12. From **Admin → Property settings**, record the numeric **Property ID**.
13. Grant the integration Google account **Viewer** (or higher) on this property.

## After the property exists

1. Platform Google OAuth app must already be in env.
2. Owner connects Google: [`connect-google.md`](connect-google.md).
3. **Refresh resources**. The property appears in the GA4 dropdown.
4. Map it per restaurant: [`map-locations.md`](map-locations.md).

Several restaurants may share one GA4 property if they share one site. Document that; do not invent a second property.

## Checklist

- [ ] Existing property reused when it exists
- [ ] Integration Google user has Viewer (or higher)
- [ ] Numeric Property ID recorded for mapping (not put in `.env`)
- [ ] Measurement ID installed on the site only if they need **new** web hits
- [ ] Mapped on Administration → Integrations after OAuth

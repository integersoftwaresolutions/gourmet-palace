# Google Search Console (per org)

Search Console is a **website property**, not a platform env var. There is no `GSC_SITE_URL` in `.env`.

This is the Accounts.MD Search Console guide, kept here because it is the client’s Search Console account. Gourmet Palace lists sites the connecting Google user can access, then you map the exact `siteUrl` on Integrations.

V1 reads search analytics (clicks, impressions, CTR, position, top queries/pages) for the mapped site.

## What to collect from the client

- Whether the website is **already** in Search Console (use that property)
- Exact property string, one of:
  - Domain: `sc-domain:gourmetpalace.com`
  - URL prefix: `https://www.gourmetpalace.com/`
- Which restaurant(s) that site belongs to (often one site for all locations)
- Google account that will click **Connect with OAuth** (must be a user on the property)

## Option A — property already exists (preferred)

1. Open [Google Search Console](https://search.google.com/search-console/).
2. Select the existing property. Do not add a duplicate.
3. **Settings → Users and permissions**.
4. Confirm the integration Google account is a user (Full or Restricted; read is enough for this app).

## Option B — starting Search Console from zero

1. Open Search Console → **Add property**.

### Domain property (usually preferred if they control DNS)

Example: `gourmetpalace.com`

Covers http, https, www, non-www, and subdomains for that domain.

### URL-prefix property

Example: `https://www.gourmetpalace.com/`

Applies only to that prefix. Use this if they cannot verify the whole domain.

## Verify ownership

### Domain property

Google shows a DNS TXT record similar to:

```
google-site-verification=xxxxxxxxxxxxxxxx
```

1. Copy the value.
2. In the domain DNS host (Cloudflare, GoDaddy, Namecheap, etc.), add a **TXT** record as Google instructs.
3. Save DNS. Propagation can take minutes to hours.
4. Return to Search Console → **Verify**.
5. **Settings → Users and permissions** — add the integration Google account if it is not the owner.

### URL-prefix property

Google offers HTML file, HTML tag, Google Analytics, Google Tag Manager, or DNS. Use whichever they already control. Complete **Verify**, then add the integration user.

## After the property exists

1. Connect Google in Gourmet Palace: [`connect-google.md`](connect-google.md).
2. **Refresh resources**. The site appears as `siteUrl` (domain or URL-prefix string).
3. Map that exact value per restaurant: [`map-locations.md`](map-locations.md).

New Search Console properties have little or no history. Existing properties keep their history.

## Checklist

- [ ] Existing property reused when it exists
- [ ] Ownership verified
- [ ] Integration Google user has access
- [ ] Exact `siteUrl` recorded (`sc-domain:…` vs `https://…/` are different)
- [ ] Mapped on Integrations after OAuth — not stored in `.env`

# Google OAuth app (platform)

Creates the **one** Google Cloud OAuth client this Gourmet Palace API uses.

## Env vars

| Variable | Example |
| --- | --- |
| `GOOGLE_CLIENT_ID` | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-…` |
| `GOOGLE_REDIRECT_URI` | must match the callback URL **exactly** |

Local default used by this repo:

```
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/integrations/google/callback
```

Production example (API host, not the frontend host):

```
GOOGLE_REDIRECT_URI=https://api.example.com/api/v1/integrations/google/callback
```

If this is missing, **Connect with OAuth** for Google returns `503 Google OAuth is not configured on the server`.

GA4 Property IDs, Search Console sites, and GBP listings are **not** env vars. Create or reuse those client properties here:

- [`../per-org/google-analytics-4.md`](../per-org/google-analytics-4.md)
- [`../per-org/google-search-console.md`](../per-org/google-search-console.md)
- [`../per-org/google-business-profile.md`](../per-org/google-business-profile.md)

After OAuth they appear on **Administration → Integrations**. See [`../per-org/connect-google.md`](../per-org/connect-google.md).

## What this app is allowed to do

The API requests these scopes (hard-coded):

| Scope | Used for |
| --- | --- |
| `openid` `email` | Identify the authorizing Google account |
| `https://www.googleapis.com/auth/analytics.readonly` | GA4 |
| `https://www.googleapis.com/auth/webmasters.readonly` | Search Console |
| `https://www.googleapis.com/auth/business.manage` | Business Profile performance **and** posting approved review replies |

`business.manage` is write-capable because V1 posts **explicitly approved** Google review replies. Do not add extra scopes.

## Step by step

### 1. Create a Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Sign in with a Google account the **client owns**.
3. Project selector → **New Project**.
4. Name it, for example `Gourmet Palace`.
5. Create it and select it.

### 2. Enable APIs

**APIs & Services → Library**. Enable **all** of these (the previous guide missed Admin API and reviews):

| Exact library name | Why this codebase needs it |
| --- | --- |
| **Google Analytics Admin API** | Lists GA4 properties (`analyticsadmin.googleapis.com/.../accountSummaries`) |
| **Google Analytics Data API** | Sessions / users / key events reports |
| **Google Search Console API** | Sites list and search analytics |
| **My Business Account Management API** | GBP accounts |
| **My Business Business Information API** | GBP locations |
| **Business Profile Performance API** | Maps / search / calls / directions metrics |
| **Google My Business API** | Review list and reply (`mybusiness.googleapis.com/v4/...`) |

Search the **exact** names. Use `My Business Account Management API`, not a similarly worded substitute.

If Business Profile APIs are hidden or fail to enable, request Google Business Profile API access for that Cloud project, then retry.

### 3. Configure the OAuth consent screen

**Google Auth Platform** (or **APIs & Services → OAuth consent screen**).

1. **User type:** External, unless every authorizing user is in the same Google Workspace and Internal is available.
2. **App name:** for example `Gourmet Palace`.
3. Support email and developer contact email (client-owned).
4. **Audience / Test users:** while the app is in Testing, add every Google account that will click **Connect with OAuth** (Owner/Admin plus anyone who holds GA4 / GSC / GBP).
5. **Data Access / Scopes:** add the five scopes listed above. Google may require verification before `business.manage` can be used by arbitrary Google accounts in Production. Until then, keep Testing mode and listed test users.

### 4. Create a Web application client

**Google Auth Platform → Clients → Create Client → Web application.**

**Authorized JavaScript origins** (frontend origin; no path):

| Environment | Origin |
| --- | --- |
| Local | `http://localhost:5173` |
| Production | `https://app.example.com` |

**Authorized redirect URIs** (API callback; **must** include `/api/v1`):

| Environment | Redirect URI |
| --- | --- |
| Local | `http://localhost:4000/api/v1/integrations/google/callback` |
| Production | `https://<api-host>/api/v1/integrations/google/callback` |

Wrong URIs that will fail (do not use these):

- `http://localhost:3000/api/integrations/google/callback`
- `https://dashboard.example.com/api/integrations/google/callback`
- Frontend origin + `/admin/integrations` (that is the **post-login** return page, not the OAuth callback)

Create the client. Copy **Client ID** and **Client Secret**.

### 5. Put values in server env

```
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_REDIRECT_URI=http://localhost:4000/api/v1/integrations/google/callback
```

`GOOGLE_REDIRECT_URI` must equal the Google Console redirect URI character-for-character (`http` vs `https`, host, port, path, no trailing slash unless both sides have one).

Restart the API after changing env.

### 6. Grant the connecting Google user access

The person who will click **Connect with OAuth** must already have access to:

- each GA4 property (Viewer is enough to read)
- each Search Console property
- each Google Business Profile location (Manager or Owner; reply posting needs permission to reply)

Creating a **new** GA4 property or Search Console site is only required if the restaurant has none. Prefer existing properties so history is kept. Full how-tos: [GA4](../per-org/google-analytics-4.md), [Search Console](../per-org/google-search-console.md), [Business Profile](../per-org/google-business-profile.md). Website Measurement ID (`G-XXXX`) is for the restaurant website tag; this API uses the numeric GA4 **property**, discovered after OAuth.

## Checklist

- [ ] Cloud project created and selected
- [ ] All seven APIs enabled
- [ ] Consent screen configured; test users added if in Testing
- [ ] Web client created
- [ ] Redirect URI is `/api/v1/integrations/google/callback` on the **API** host
- [ ] `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` in server env
- [ ] Connecting Google user has GA4, Search Console, and GBP access

Next: [`../per-org/connect-google.md`](../per-org/connect-google.md)

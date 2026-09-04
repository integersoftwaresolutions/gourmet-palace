# Square Developer app (platform)

Creates the **one** Square OAuth application this Gourmet Palace API uses. Square is the only **live** V1 POS.

## Env vars

| Variable | Allowed / example |
| --- | --- |
| `SQUARE_ENVIRONMENT` | `sandbox` or `production` |
| `SQUARE_APPLICATION_ID` | Square Application ID |
| `SQUARE_APPLICATION_SECRET` | Square Application Secret |
| `SQUARE_REDIRECT_URI` | must match Square Dashboard redirect URL **exactly** |

Local defaults:

```
SQUARE_ENVIRONMENT=sandbox
SQUARE_REDIRECT_URI=http://localhost:4000/api/v1/integrations/square/callback
```

Production:

```
SQUARE_ENVIRONMENT=production
SQUARE_REDIRECT_URI=https://<api-host>/api/v1/integrations/square/callback
```

If Application ID/Secret are missing, **Connect with OAuth** for Square returns `503 Square OAuth is not configured on the server`.

Square location IDs and channel labels are **not** env vars. See [`../per-org/connect-square.md`](../per-org/connect-square.md).

## Scopes this app actually requests

Hard-coded in the API. Configure the Square app to allow them. Do not invent Customers write or other extras.

| Scope | Why |
| --- | --- |
| `MERCHANT_PROFILE_READ` | Required to list Square locations for mapping |
| `ORDERS_READ` | Required. Without it Square stays UNAVAILABLE |
| `PAYMENTS_READ` | Refunds and daily reconciliation. Without it days stay Partial |
| `ITEMS_READ` | Catalog/category enrichment |
| `INVENTORY_READ` | Entitlement for inventory-related Square data |
| `EMPLOYEES_READ` | Granted; unused fields stay unavailable rather than invented |
| `PAYOUTS_READ` | Granted; unused fields stay unavailable rather than invented |

## Sandbox vs production

| Use | `SQUARE_ENVIRONMENT` | Credentials to copy |
| --- | --- | --- |
| Local / staging tests | `sandbox` | Sandbox Application ID and Secret |
| Live restaurant data | `production` | **Production** Application ID and Secret |

Sandbox and production are different apps/credentials. Mixing a production redirect with sandbox keys (or the reverse) fails OAuth.

## Step by step

### 1. Create the application

1. Open [Square Developer Applications](https://developer.squareup.com/apps).
2. Sign in with a Square account the **client owns**.
3. **Create app**. Name it, for example `Gourmet Palace`.
4. Open the app.

### 2. Pick the environment

In the Square Developer Dashboard, switch **Sandbox** or **Production** **before** copying credentials.

For real Gourmet Palace locations you eventually need Production.

### 3. Copy Application ID and Application Secret

From that environment’s credentials panel:

- Application ID → `SQUARE_APPLICATION_ID`
- Application Secret → `SQUARE_APPLICATION_SECRET`

Share the secret only through a private channel. Do not put it in screenshots, tickets, or git.

### 4. Set the OAuth redirect URL

Square Developer app → **OAuth**.

Add **exactly**:

| Environment | Redirect URL |
| --- | --- |
| Local | `http://localhost:4000/api/v1/integrations/square/callback` |
| Production | `https://<api-host>/api/v1/integrations/square/callback` |

Do **not** use `/api/integrations/square/callback` (missing `v1`) or a frontend URL.

The same string must be set as `SQUARE_REDIRECT_URI`.

### 5. Put values in server env

```
SQUARE_ENVIRONMENT=sandbox
SQUARE_APPLICATION_ID=<id>
SQUARE_APPLICATION_SECRET=<secret>
SQUARE_REDIRECT_URI=http://localhost:4000/api/v1/integrations/square/callback
```

Restart the API.

The Square **owner does not give you a password**. They click **Connect with OAuth** while logged into Gourmet Palace as Owner/Admin.

## Checklist

- [ ] Square Developer app created in a client-owned account
- [ ] Correct environment selected
- [ ] Application ID and Secret copied for that environment
- [ ] Redirect URL is `/api/v1/integrations/square/callback` on the **API** host
- [ ] All six read scopes above are allowed
- [ ] Four Square env vars set; API restarted

Next: [`../per-org/connect-square.md`](../per-org/connect-square.md)

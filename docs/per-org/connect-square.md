# Connect Square OAuth (per org)

Authorizes **this org** to read the client’s Square merchant. Tokens are stored in the secrets store, not in `.env`.

Platform app must already exist: [`../platform-wide/square-developer-app.md`](../platform-wide/square-developer-app.md).

## Where

**Administration → Integrations → Square · live V1 POS → Connect with OAuth**

Only Owner/Admin. Stay logged in. Complete the Square consent in the same browser session (state expires in 10 minutes).

## What to collect from the client

- A Square **owner or admin** available for about 10 minutes
- Confirmation they will approve the requested read scopes
- Sandbox vs production: the platform `SQUARE_ENVIRONMENT` must match the merchant they sign into

They must **not** give you the Square password.

## Step by step

1. Confirm `SQUARE_APPLICATION_ID`, `SQUARE_APPLICATION_SECRET`, `SQUARE_ENVIRONMENT`, and `SQUARE_REDIRECT_URI` are set and the API was restarted.
2. Sign into Gourmet Palace as Owner/Admin.
3. Open Integrations and click **Connect with OAuth** on the Square card.
4. Sign into Square as the merchant owner.
5. Review scopes. The app asks for `ORDERS_READ`, `PAYMENTS_READ`, `ITEMS_READ`, `INVENTORY_READ`, `EMPLOYEES_READ`, `PAYOUTS_READ`.
6. Authorize. Square redirects to the API callback, then back to `/admin/integrations?connected=square`.
7. Status should become **PARTIAL** until locations are mapped and a day reconciles. **UNAVAILABLE** means `ORDERS_READ` was not granted.
8. Click **Refresh resources** if the Square location dropdown is empty.
9. Use **Reconnect** if tokens were revoked or the wrong merchant was connected.

## Status meaning

| Status | Meaning |
| --- | --- |
| UNAVAILABLE | Not connected, or missing `ORDERS_READ` |
| PARTIAL | Connected but mapping, payments, or reconciliation incomplete |
| READY | Required controls passed for recent work |
| ERROR | Last job failed; see `lastError` on the card |

## Checklist

- [ ] Owner authorized Square in the product
- [ ] No password was shared with developers
- [ ] Square restaurants appear under **Refresh resources**
- [ ] Status is not UNAVAILABLE

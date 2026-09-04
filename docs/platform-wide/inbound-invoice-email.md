# Inbound invoice email (platform, optional)

Lets an email-to-invoice gateway POST PDF/JPG/PNG attachments into Gourmet Palace without a user session.

If you are not wiring inbound email, leave this empty. Staff can still upload invoices in **Operations → Invoices**.

## Env vars

| Variable | Purpose |
| --- | --- |
| `INBOUND_INVOICE_SECRET` | Shared secret the webhook must send as header `x-inbound-secret` |

```
INBOUND_INVOICE_SECRET=
```

Generate a long random value. Production should not leave this blank if the route is exposed.

## How it works

`POST /api/v1/invoices/inbound-email`

Headers:

```
x-inbound-secret: <same as INBOUND_INVOICE_SECRET>
Content-Type: application/json
```

Body (shape the API expects):

- `organizationSlug` — org slug (seed default `gourmet-palace`)
- `locationId` — Mongo id of an **active** location
- `attachments[]` with `fileName`, `mimeType` (`application/pdf`, `image/jpeg`, or `image/png`), and `base64`

Up to 10 attachments per request. Unsupported types are skipped.

## Step by step

1. Decide the inbound mailbox / provider (Resend inbound, CloudMailin, etc.). This repo does not include a vendor-specific mail parser; the gateway must POST the JSON above.
2. Create `INBOUND_INVOICE_SECRET` and put it on the API.
3. Configure the gateway to send that secret on every request.
4. Use the real organization slug and each location’s id from **Administration → Locations** (after locations exist).
5. Send a test PDF and confirm it appears in Invoices for that location.

## Checklist

- [ ] Secret generated and set, or inbound left unused
- [ ] Gateway sends `x-inbound-secret`
- [ ] Org slug and location ids confirmed
- [ ] Only PDF/JPG/PNG invoices

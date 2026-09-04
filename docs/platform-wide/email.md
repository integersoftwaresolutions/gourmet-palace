# Outbound email (platform)

Used for password reset, activation, Morning Brief delivery, and alert emails.

Resend is preferred. SMTP is used only when `RESEND_API_KEY` is empty.

## Env vars — Resend (production)

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | From header, for example `Gourmet Palace <noreply@client-domain.com>` |

```
RESEND_API_KEY=
RESEND_FROM=Gourmet Palace <noreply@example.com>
```

The From domain must be **verified in Resend** and owned by the client. A random Gmail From address will be rejected.

## Env vars — SMTP fallback (local / if Resend is unused)

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP hostname |
| `SMTP_PORT` | Usually `587` |
| `SMTP_SECURE` | `true` only for implicit TLS (typically port 465) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_FROM` | From header |

```
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Gourmet Palace <noreply@example.com>
```

If `RESEND_API_KEY` is set, SMTP is ignored.

## Step by step (Resend)

1. Create a client-owned [Resend](https://resend.com/) account.
2. Add and verify the sending domain (DNS CNAMEs / TXT as Resend shows).
3. Create an API key with send permission.
4. Set `RESEND_API_KEY` and `RESEND_FROM` using an address on that verified domain.
5. Restart the API and worker.
6. Confirm `APP_URL` is the public frontend origin so reset/activation links work.

Recipient lists (who gets briefs/alerts) are **not** env vars. They are configured per org under **Administration → System & thresholds** (alert recipient roles) and user emails in Administration.

Without outbound mail, users can still work in-app; briefs/alerts simply are not emailed.

## Checklist

- [ ] Client-owned sending domain verified
- [ ] `RESEND_API_KEY` and `RESEND_FROM` set in production
- [ ] From address uses the verified domain
- [ ] `APP_URL` matches the real frontend origin

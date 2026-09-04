# Gourmet Palace API

Node.js + Express + MongoDB (JavaScript). Session-based auth (AUTH-01–05, AUTH-07).

## Setup

1. MongoDB running locally (or set `MONGODB_URI`).
2. Configure `.env` (see `.env.example`) — especially `SESSION_SECRET` and SMTP for password reset.
3. Install and seed the Owner/Admin:

```bash
npm install
npm run seed:admin
npm run dev
```

API base: `http://localhost:4000/api/v1`

## Auth routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/signin` | Cookie session | Sign in |
| POST | `/auth/signout` | Session | Sign out |
| GET | `/auth/me` | Session | Current user |
| POST | `/auth/forgot-password` | No | Email reset link (SMTP) |
| POST | `/auth/reset-password` | No | Complete reset with token |
| POST | `/auth/change-password` | Session | Change password while signed in |

There is **no** public signup. Accounts are provisioned (seed / future Admin invite).

## Response shape

```json
{
  "success": true,
  "message": "Signed in successfully",
  "data": {},
  "meta": null,
  "errors": null
}
```

## Structure

- `modules/*/`.controller.js` — HTTP only
- `modules/*/*.service.js` — business logic
- `middlewares/` — session auth, Joi validation, correlation, rate limit, errors
- `modules/mail/` — swappable mail provider (SMTP now)
- `modules/audit/` — auth audit events
- `scripts/seedAdmin.js` — bootstrap Owner + Organization

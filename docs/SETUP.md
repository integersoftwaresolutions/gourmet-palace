# Gourmet Palace setup

V1 is one Gourmet Palace deployment with one organization. Setup is still split in two places so credentials are not mixed again.

| Folder | What it is | Where values go |
| --- | --- | --- |
| [`platform-wide/`](platform-wide/README.md) | OAuth apps, API keys, database, storage, mail, runtime | Server `.env` only |
| [`per-org/`](per-org/README.md) | This restaurant group’s connected accounts and mappings | Admin UI, especially **Administration → Integrations** |

Do **not** put Square/Google access tokens, GA4 Property IDs, Search Console URLs, or Toast files in `.env`. Create or reuse the client’s GA4 / Search Console / Business Profile in `per-org/`, then select them on the Integrations page after the platform OAuth apps exist.

Do **not** collect Square, Google, or Toast passwords. Owners authorize Square and Google themselves with OAuth.

The old mixed guide `Accounts.MD` is retired. Use this tree instead.

Related: [`DEPLOYMENT_AWS.md`](DEPLOYMENT_AWS.md), [`RUNBOOK.md`](RUNBOOK.md), [`UAT_CHECKLIST.md`](UAT_CHECKLIST.md).

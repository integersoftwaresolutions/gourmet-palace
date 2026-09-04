# MongoDB (platform)

Canonical business data lives in MongoDB. Production is client-owned MongoDB Atlas.

## Env vars

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Connection string |

Local:

```
MONGODB_URI=mongodb://127.0.0.1:27017/gourmet-palace
```

Atlas example:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
```

## Step by step (Atlas)

1. Create a client-owned Atlas project/cluster.
2. Create a database user used only by this app.
3. Network access: allow the API/worker (Atlas Network Access / Private Endpoint / IP allowlist). Do not open `0.0.0.0/0` in production.
4. Enable Cloud Backup and point-in-time recovery on the selected plan.
5. Copy the connection string into `MONGODB_URI` for **both** API and worker.
6. From `backend/`: `npm run seed:admin` **once** against the intended database. Do not load synthetic restaurant history.

Seed env that creates the first org (still platform bootstrap, not Integrations):

```
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_NAME=
SEED_ORG_NAME=Gourmet Palace
SEED_ORG_SLUG=gourmet-palace
SEED_LOCATIONS_JSON=[]
```

Leave `SEED_LOCATIONS_JSON` empty unless you have a reason. Create restaurants in **Administration → Locations** after first sign-in.

Change the seed password before production. Give the Owner login to the client directly; there is no public registration.

## Checklist

- [ ] `MONGODB_URI` set on API and worker
- [ ] Atlas backups/PITR enabled in production
- [ ] Network limited to the app
- [ ] Owner seeded; no synthetic restaurant history loaded

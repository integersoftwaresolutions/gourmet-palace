# Provider secrets store (platform)

After an Owner clicks **Connect with OAuth**, Square and Google **access/refresh tokens** are stored here. MongoDB `Connection` documents keep only a `secretRef` plus non-secret metadata.

This is **not** where `GOOGLE_CLIENT_SECRET` or `SQUARE_APPLICATION_SECRET` live. Those stay in process env.

## Env vars

| Variable | Local | Production |
| --- | --- | --- |
| `SECRET_STORE_PROVIDER` | `local` | `aws` (**required** when `NODE_ENV=production`) |
| `SECRET_STORE_PREFIX` | `gourmet-palace` | same or env-specific prefix |
| `LOCAL_SECRETS_DIR` | `storage/secrets` | unused if AWS |
| `SECRET_ENCRYPTION_KEY` | strong random value | required for local encrypted files; still set a unique key |
| `AWS_REGION` | `us-west-2` | region of Secrets Manager |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` | empty if possible | optional; prefer ECS task role |

```
SECRET_STORE_PROVIDER=local
SECRET_STORE_PREFIX=gourmet-palace
LOCAL_SECRETS_DIR=storage/secrets
SECRET_ENCRYPTION_KEY=replace-with-separate-strong-random-value
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
```

## Step by step (production)

1. Set `SECRET_STORE_PROVIDER=aws`.
2. Grant the ECS task role `secretsmanager:GetSecretValue`, `CreateSecret`, `PutSecretValue` on `gourmet-palace/<env>/*` (or your prefix).
3. Do not put Square/Google user tokens in `.env`.
4. After OAuth, confirm Mongo has `secretRef` and Secrets Manager has the payload.

Local files under `storage/secrets` are encrypted with `SECRET_ENCRYPTION_KEY`. Keep that key out of git.

## Checklist

- [ ] Production uses `SECRET_STORE_PROVIDER=aws`
- [ ] Task role can read/write the prefix
- [ ] `SECRET_ENCRYPTION_KEY` is unique and not reused as `SESSION_SECRET`

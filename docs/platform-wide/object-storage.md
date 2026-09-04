# Private object storage (platform)

Stores invoice originals, derived files, unchanged Toast archives, and raw provider ingest JSON. Not public S3 website hosting.

## Env vars

| Variable | Local | Production |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `local` | `s3` (required when `NODE_ENV=production`) |
| `LOCAL_STORAGE_DIR` | `storage/private` | unused if S3 |
| `S3_BUCKET` | empty | required |
| `S3_REGION` | `us-west-2` | bucket region |
| `S3_ENDPOINT` | empty for AWS S3 | only for S3-compatible custom endpoints |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_SESSION_TOKEN` | usually empty | optional; prefer ECS task role |
| `S3_FORCE_PATH_STYLE` | `false` | `true` only if the endpoint requires it |
| `FILE_SIGNING_SECRET` | set a strong random value | **required** in production |

```
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=storage/private
S3_BUCKET=
S3_REGION=us-west-2
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_SESSION_TOKEN=
S3_FORCE_PATH_STYLE=false
FILE_SIGNING_SECRET=
```

`FILE_SIGNING_SECRET` signs short-lived file URLs. Use a different strong random value from `SESSION_SECRET` and `SECRET_ENCRYPTION_KEY`.

## Step by step (production S3)

1. Create a **private** versioned bucket in the client-owned AWS account.
2. Block all public access.
3. Grant the ECS task role `s3:GetObject` and `s3:PutObject` on that bucket/prefix only.
4. Set `STORAGE_PROVIDER=s3`, `S3_BUCKET`, `S3_REGION`.
5. Leave explicit S3 keys empty when using a task role.
6. Set `FILE_SIGNING_SECRET`.
7. Confirm a test invoice upload and that the object is not world-readable.

Frontend production static files (CloudFront) are a **different** bucket from this private bucket.

## Checklist

- [ ] Production uses `STORAGE_PROVIDER=s3` and a private versioned bucket
- [ ] `FILE_SIGNING_SECRET` set
- [ ] Public access blocked
- [ ] Task role preferred over long-lived keys

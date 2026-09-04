# OpenAI API key (platform)

Server-side only. Never put this key in the frontend or in `VITE_*` variables.

## Env vars

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Billing-enabled secret key (`sk-…`) |
| `OPENAI_MODEL` | Model id. Repo default: `gpt-5-mini` |

```
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

The client owns the OpenAI account and pays usage, including during development (spec A-13).

## What the key is used for

| Feature | If the key is missing |
| --- | --- |
| Ask-the-AI narratives | Deterministic fallback text from evidence |
| Command-center performance sentence | Deterministic fallback |
| Invoice OCR field extraction | Manual review required |
| Google review reply drafts | `503 OpenAI is not configured` |

OpenAI never calculates money or KPIs. It only narrates or extracts against server-supplied evidence.

## Step by step

1. Create or use a **client-owned** OpenAI organization at [platform.openai.com](https://platform.openai.com/).
2. Add a payment method and confirm billing is enabled.
3. **API keys → Create new secret key**.
4. Copy the key once. Store it in a password manager / secrets store.
5. Set `OPENAI_API_KEY` (and `OPENAI_MODEL` if you are not using the default) on the API **and** worker services. Both processes read the same env.
6. Restart API and worker.
7. Restrict the key if possible (no unused project keys in git or chat).

Do not use a personal developer key in production. Rotate any key that was pasted into email or screenshots.

## Checklist

- [ ] Client-owned billed OpenAI org
- [ ] Secret key created
- [ ] `OPENAI_API_KEY` on API and worker
- [ ] `OPENAI_MODEL` set or left at `gpt-5-mini`
- [ ] Key not in frontend env or git

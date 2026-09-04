# Create locations (per org)

Canonical restaurants must exist before Square/Google mapping, Toast upload, or backfill.

## Where

**Administration → Locations** (`/admin/locations`)

## What to collect from the client

For each restaurant:

| Field | Notes |
| --- | --- |
| Name | Unique within the org |
| Address | Optional |
| IANA timezone | Default `America/Los_Angeles`. Business day ends at **4:00 AM local** in this timezone |
| Status | Active for live mapping |

Executive Morning Brief scheduling uses `America/Los_Angeles` for the 5:00 AM Pacific target even if a location uses another timezone for its business day.

## Step by step

1. Sign in as Owner/Admin.
2. **Add location** for every restaurant that will report.
3. Set timezone correctly before the first Square sync (wrong timezone mis-buckets overnight orders).
4. Leave locations **active**. Inactive locations cannot be mapped or synced.
5. Create Manager users later and assign only the locations they may see.

Do not rely on `SEED_LOCATIONS_JSON` unless you have a prepared seed. The UI is the normal path.

## Checklist

- [ ] Every live restaurant exists and is active
- [ ] Timezones confirmed with the client
- [ ] Location names match how the client talks about sites (helps mapping)

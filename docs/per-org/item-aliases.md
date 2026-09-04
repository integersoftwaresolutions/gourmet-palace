# Cross-POS item aliases (per org)

Optional. Maps a Square catalog id/name or Toast item id/name to one canonical reporting name.

Aliases apply to **live Square ingest and Toast import only after** the approval checkbox is saved.

## Where

**Administration → Integrations → Cross-POS canonical item aliases**

## What to collect from the client

Lines they are sure about:

```
source item id or name = Canonical item name | Optional category
ABC123 = Chicken Breast | Meat
Chx Breast = Chicken Breast | Meat
```

Leave uncertain matches unmapped. Provider ids stay on the order for provenance either way.

Limit: 2000 aliases.

## Step by step

1. Export or sample Square catalog names/ids and Toast item names/ids.
2. Paste only confident pairs.
3. Save **without** approval to store a draft, or check **I approve these aliases** when the client signs off.
4. If Toast was imported before approval, import/reprocess after approval if you need aliases applied to historical Toast rows (original CSV stays unchanged in private storage).

## Checklist

- [ ] Only confident aliases
- [ ] Approval checked only when the client agrees
- [ ] Square remains live authority on overlapping days

# Inventory starter list (per org)

V1 inventory is **manual**. Square sales do not decrement on-hand quantity. Days remaining is an estimate.

## Where

**Operations → Inventory**

CSV import/export, bulk update, and copy-previous are available in that module.

## What to collect from the client

Per location, about **30–50 core items** to start:

| Field | Required |
| --- | --- |
| Name | Yes (unique per location) |
| Unit | Yes |
| Current quantity | Opening count |
| Par level | For low-stock warnings |
| Ingredient cost | Optional |
| Vendor | Optional link |

Without this list the screen can launch empty; stale/critical warnings stay incomplete.

## Step by step

1. Create locations.
2. Collect the core list from managers.
3. Enter or CSV-import items per location.
4. Agree who counts, and that counts go stale after the configured hours (default 24).
5. Keep units consistent (do not mix kg and lb on the same item name).

## Checklist

- [ ] Core items loaded per location
- [ ] Units and pars agreed
- [ ] Managers know counts are manual

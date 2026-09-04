# Square channel mapping (per org)

Classifies Square orders into dine-in, takeout, delivery, third-party, and direct online.

**Direct-online volume and revenue stay unpublished** until this mapping is explicitly approved and checked against real Square data (spec A-06 / POS-09).

## Where

**Administration → Integrations → Square channel mapping**

## What to collect from the client

Exact **source names** and/or **fulfillment types** as they appear on Square orders, for example:

| Canonical channel | Example Square labels (comma-separated fragments) |
| --- | --- |
| dine_in | `Dining Room`, `Dine In` |
| takeout | `Pickup`, `Takeout` |
| delivery | `Delivery` |
| third_party | `DoorDash`, `Uber Eats`, `Grubhub` |
| direct_online | `Online Store`, `Square Online`, `Website` |

Unmatched orders become **unknown**. The app does not guess.

Ask the client for a few real order examples per channel before they tick approval.

## Step by step

1. Connect Square and sync or inspect representative orders (or use Square Dashboard source/fulfillment names).
2. Enter comma-separated fragments for each channel. Matching is case-insensitive substring on `order.source.name` or the first fulfillment type.
3. Click **Save channel mapping** **without** checking approval if you are still drafting. Direct-online metrics remain withheld.
4. After a sample period looks correct, the Owner checks **I approve this final Square channel mapping for go-live** and saves again.
5. Re-run Square sync/backfill for dates that should publish direct-online metrics.

Changing mapping without approval does not publish direct-online SEO metrics.

## Checklist

- [ ] Labels taken from real Square data, not assumed
- [ ] Uncertain traffic left unmapped (unknown)
- [ ] Approval box checked only after the client signs off
- [ ] Direct-online KPIs still hidden until approval

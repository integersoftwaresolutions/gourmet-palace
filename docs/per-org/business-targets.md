# Business targets, score weights, alerts (per org)

Not env vars. Versioned in **Administration → System & thresholds**.

New versions are **effective-dated**. Old daily snapshots are not rewritten.

## Where

**Administration → System & thresholds** (`/admin/system`)

Scope: organization default, or override per location.

## What to collect from the client

| Setting | V1 default if they say nothing |
| --- | --- |
| Food-cost target min–max | 20%–22% (purchase-based estimate, not COGS) |
| Selected margin | 15% (planning estimate, not live P&L) |
| Score weights | Sales 40%, demand 25%, exceptions 20%, operating 15% (must total 100%) |
| Alert on/off, severity, thresholds, cooldown | See catalogue below |
| Email recipient roles per alert | `owner`, `admin`, `manager` |

User email addresses come from Administration → Users. Alerts email those roles when outbound mail is configured.

## Fixed V1 alert types

| Key | Default idea |
| --- | --- |
| `sales_below_normal` | % below comparable |
| `exceptions_above_normal` | refunds/voids/discounts |
| `average_ticket_dropping` | |
| `location_underperforming_peers` | score gap |
| `urgent_negative_review` | max star rating |
| `vendor_price_increase` | % vs prior observation |
| `food_cost_above_target` | |
| `direct_orders_declining` | only meaningful after channel mapping is approved |
| `inventory_critical` | days remaining |
| `system_data_quality` | |

You cannot invent new alert types in V1.

## Step by step

1. Ask the client for food-cost band, margin assumption, and who should be emailed.
2. Set scope (org vs one location).
3. Set **Effective from**.
4. Save a new version.
5. Confirm history shows the new row.

## Checklist

- [ ] Client confirmed food-cost % and margin
- [ ] Weights total 100%
- [ ] Alert recipients match real user roles
- [ ] Outbound email configured if they expect mail ([`../platform-wide/email.md`](../platform-wide/email.md))

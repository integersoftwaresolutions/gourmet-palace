# Square historical backfill (per org)

Pulls live Square history through the same path as daily sync, one business day at a time. Complete days are skipped on rerun; Partial/Failed days resume without duplicating provider order ids.

## Where

**Administration → Integrations → Square historical backfill**

Requires: Square connected, location mapped, Owner/Admin.

## What to collect from the client

- Approved **from** and **to** dates (`YYYY-MM-DD`)
- Target 12+ months when Square has it
- Confirmation Production OAuth is used for real history (sandbox will not match the restaurant)

Maximum **370** calendar days per request. Split longer ranges.

## Step by step

1. Map the Square restaurant for that location.
2. Optionally save channel mapping (unapproved is fine for financial history; direct-online SEO metrics wait for approval).
3. Choose location, from, to.
4. **Run backfill**.
5. Read complete / partial / failed counts.
6. Re-run the same range to resume incomplete days.
7. Inspect **Administration → System & thresholds** for job errors and reconciliation.

A day is complete only when the business day is closed (after 4:00 AM local), `ORDERS_READ` and `PAYMENTS_READ` work, and reconciliation passes (order count exact; net sales within ±0.5% or $5; refund/void/discount within ±1% or $3 when controls exist).

Go-live still needs three successful **live** production cycles, not only backfill.

## Checklist

- [ ] Client approved the date window
- [ ] Location mapped to Square
- [ ] Ranges ≤ 370 days each
- [ ] Partial/failed days re-run
- [ ] Reconciliation reviewed before calling history done

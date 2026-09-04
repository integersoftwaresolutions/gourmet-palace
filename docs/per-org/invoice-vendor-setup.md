# Invoices and vendors (per org)

Purchase-based food cost and vendor price observations come from **approved** invoices, not from POS.

OCR uses the platform OpenAI key. Humans must confirm invoice number, date, and total before approval.

## Where

- **Operations → Invoices** — upload PDF/JPG/PNG
- **Operations → Vendors** — vendor records and spend
- Optional inbound email: [`../platform-wide/inbound-invoice-email.md`](../platform-wide/inbound-invoice-email.md)

## What to collect from the client

- Representative **real invoice samples** (for OCR quality; do not certify ≥90% from demo files)
- Vendor names / aliases as they appear on invoices
- Which location each vendor delivers to
- Food vs other spend categories they care about
- A few **approved corrections** so reusable mappings can form

## Step by step

1. Confirm `OPENAI_API_KEY` if automatic extraction is expected.
2. Upload sample invoices per location.
3. Review OCR, correct fields, confirm number/date/total.
4. Dispose duplicates explicitly.
5. Approve only after confirmation. Unapproved invoices do not enter food-cost totals.
6. Check vendor price observations after approvals.

## Checklist

- [ ] Sample invoices from the real vendors
- [ ] Location assignment correct
- [ ] Approval gating understood by managers
- [ ] OCR acceptance judged on client samples, not seed data

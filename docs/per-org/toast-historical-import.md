# Toast historical import (per org)

Toast is **not** a live V1 connector. There is no Toast API key in env.

Import a client CSV once (or reprocess the **same archived file** if mapping is corrected). The original bytes are stored unchanged in private object storage, then parsed.

## Where

**Administration → Integrations → Toast historical export · one-time only**

A **Download sample CSV** button on that card provides the expected headers and a few example rows. Use it as a template only; upload the client’s original export when available.

## What to collect from the client

- Original export **unedited** (do not “clean” it in Excel first)
- All reasonably available history, target **12+ months**
- File **CSV**, **≤ 30 MB**
- Which Gourmet Palace location the file belongs to (one location per upload)
- Column names if they differ from the defaults

Default headers the importer looks for:

| Header | Required |
| --- | --- |
| `orderId` | Yes |
| `businessDate` | Yes (`YYYY-MM-DD`) |
| `netSales` | Yes |
| `grossSales` | No |
| `discounts` | No |
| `refunds` | No |
| `channel` | No |
| `itemId` `itemName` `itemCategory` `itemQuantity` `itemNetSales` | No; used for line items |

If headers differ, the file must be mapped before upload (the UI currently sends the default header names). Prefer asking Toast/the client to export with these names, or rename **only a copy** while keeping the original archive as they delivered it. Spec requires the **original** file to be archived unchanged — upload the original; if headers cannot parse, keep that original in storage and use a documented mapping procedure rather than silently editing the archive.

Rows without a valid `orderId` and `YYYY-MM-DD` `businessDate` are skipped.

## Step by step

1. Confirm object storage is configured (local or S3).
2. Select the **canonical location**.
3. Optionally download the sample CSV to confirm column names.
4. Upload the CSV.
5. Confirm the notice: imported row count; original archive retained.
6. Repeat per location if they send multiple files.
7. Do not treat this as a live Toast sync. Later days come from Square.

On overlapping dates, Square is authoritative for the live day. Toast facts stay for history/provenance and are not double-counted as a second live POS.

## Checklist

- [ ] Original file archived, not prettified
- [ ] Required columns present
- [ ] Correct location selected
- [ ] Import count looks plausible
- [ ] No Toast live credentials requested

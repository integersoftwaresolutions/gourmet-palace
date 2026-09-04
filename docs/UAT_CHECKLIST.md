# Gourmet Palace V1 UAT Checklist

Use staging with client-authorized test/sandbox providers first. Record date, tester, evidence link and pass/fail for every item. A requirement is not accepted merely because the screen renders.

| UAT | Verification | Pre-live implementation state |
|---|---|---|
| UAT-01 | Owner sees all locations; Manager can see/query only assigned locations, including filters/API/AI. | Implemented; run negative tests with two Manager scopes. |
| UAT-02 | Square backfill + three live cycles meet order count/net/refund/void/discount reconciliation tolerances; Toast stays historical-only. | Logic implemented; requires real Square cycles. |
| UAT-03 | Command Center shows prior day, Business Health coverage/comparable change, transparent score inputs/weights, location rank, best/weakest and evidence-backed priorities/actions. | Implemented. |
| UAT-04 | Finance labels purchase-based food cost and selected-margin profit; initial margin 15%. | Implemented. |
| UAT-05 | Client-approved Square channel mapping is validated; unmapped remains Unknown. | Approval gate implemented; requires representative client Square data. |
| UAT-06 | Ask-AI answers supported questions and refuses unsupported/unavailable margin evidence. | Implemented; evaluate with staged data. |
| UAT-07 | Changing an alert threshold changes subsequent evaluation without deployment. | Effective-dated settings implemented. |
| UAT-08 | Morning Brief is published by target 5:00 AM Pacific by email + dashboard. | Worker/delivery implemented; requires production timing/domain test. |
| UAT-09 | Invoice cannot affect reporting until approval; duplicate must be dispositioned. | Implemented. |
| UAT-10 | Manager count changes update days remaining/low stock and retain history. | Implemented. |
| UAT-11 | Google reply cannot post without Owner/Admin approval + final confirmation. | Implemented; requires GBP posting permission test. |
| UAT-12 | Approved Toast/Square aliases share canonical history as intended; original Toast export remains unchanged/private. | Import/archive and overlap control implemented; verify with client export. |
| UAT-13 | Yesterday/7d/30d/WTD/MTD/YTD/custom and prior-year comparison work with unavailable history labeled. | Implemented. |
| UAT-14 | Partial 5 AM brief receives a newer current revision after delayed data reconciles; old revision retained. | Implemented; simulate provider delay in staging. |
| UAT-15 | Q2 vs Q1, month summary and 90-day vendor questions remain scoped, evidenced and non-invented. | Implemented; run agreed prompt set. |
| UAT-16 | Invoice categories, correction reuse, Vendor Intelligence and price history use approved invoices only. | Implemented. |
| UAT-17 | Admin score-weight change affects subsequent score calculation. | Implemented; weights validated to 100%. |
| UAT-18 | Stale inventory indication works and mobile count/update flow is usable. | Implemented; verify target mobile breakpoints. |
| UAT-19 | Light Mode works and Reporting Center is top-level after Morning Brief for Owner/Admin. | Implemented. |

## Additional security/operational checks

- attempt Manager access to another `locationId` by direct API request,
- attempt Manager Finance/SEO/Reporting/Google review endpoints,
- verify expired/deactivated/logged-out sessions fail,
- verify reset/activation tokens are single-use and expire,
- verify old invoice signed links expire,
- verify logs contain no OAuth code/token/password/reset token/full invoice body,
- verify prompt injection cannot mutate data or post a review,
- verify source failure produces system/data-quality state rather than a normal business alert,
- verify Toast original object hash is unchanged after import/reprocessing,
- perform Atlas staging restore and S3 object-version recovery before production acceptance.

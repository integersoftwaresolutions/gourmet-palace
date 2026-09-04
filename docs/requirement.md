**GOURMET PALACE**

**COMMAND CENTER**

**Combined Business, Functional & Technical Specification**

**Business Requirements  •  V1 Scope  •  Functional Detail  •  MongoDB Architecture  •  AI Controls  •  Acceptance**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Version | 1.2 |
| :---- | :---- |
| **Status** | Final Draft for Stakeholder Approval |
| **Prepared** | 11th Aug 2026 |
| **Classification** | Confidential — Project Use |
| **Supersedes** | Version 1.1 dated 8 Aug 2026 |

**PURPOSE**

This document is the proposed official V1 implementation blueprint and Upwork scope baseline. Once approved by both parties, it governs product behavior, delivery boundaries, acceptance and change control.

# **Contents**

**1\. Executive Summary**

**2\. Business Context, Objectives and Success Measures**

**3\. Version 1 Scope, Assumptions and Boundaries**

**4\. Users, Roles and Permissions**

**5\. User Flows, Navigation and Screens**

**6\. Functional Specification by Module**

**7\. Technical Architecture**

**8\. POS Abstraction, Square Entitlements and External Data**

**9\. Data Ingestion, Scheduling and Reconciliation**

**10\. MongoDB Data Model**

**11\. AI, Analytics, Scoring and Forecasting**

**12\. Invoice OCR, Food Cost and Inventory**

**13\. Security, Privacy and Non-Functional Requirements**

**14\. Testing, UAT, Deployment and Handover**

**15\. Delivery Plan, Change Control, Risks and Decisions**

Appendices A–F

# **1\. Executive Summary**

Gourmet Palace Command Center is a centralized management and decision-support platform for the restaurant group. It brings sales, store performance, finance insights, customer reviews, SEO and direct-order visibility, invoices, vendor pricing, inventory, alerts and executive reporting into one place so owners and managers can understand performance quickly and act with confidence.

Version 1 uses Square as the live POS integration, while Toast provides a one-time historical export before decommissioning. V1 includes location scorecards and rankings, the Morning Executive Brief, an Executive Reporting Center with daily/weekly/monthly reporting and exports, controlled Ask-the-AI assistance, invoice OCR with human confirmation, purchase-based food-cost visibility and manual inventory tracking. Delayed, incomplete or unavailable data is clearly identified rather than presented as final.

| V1 SCOPE VERDICTBuild the requested decision-support system, not a restaurant ERP. Version 1 is designed to consolidate and explain business data so Gourmet Palace can monitor performance, identify issues quickly and make better decisions. It does not include payment processing, accounting automation, purchasing automation, continuous recipe depletion, or unrestricted AI access to business data. |
| :---- |

## **1.1 Intended outcomes**

**•** A single trusted view of prior-day performance across authorized locations.

**•** Daily location score and ranking that quickly identifies the strongest and weakest store.

**•** A 5:00 AM Pacific executive brief delivered by email and retained in the dashboard.

**•** Automatic detection of material deviations using location- and weekday-specific baselines.

**•** Transparent finance estimates with 20%–22% food-cost targets and a 15% estimated operating-margin target.

**•** Controlled answers to the client’s must-have business questions using actual Gourmet Palace data.

**•** Future-ready expansion to more locations, brands and POS adapters without redesigning the core product.

## **1.2 Definition of done**

**•** All in-scope requirements in Section 6 pass their stated acceptance conditions and role/location-scope tests.

**• Square historical backfill and three successful live production cycles reconcile within the tolerances defined in Section 9.3; Toast history is imported into the same canonical history where appropriate, while the original Toast export is retained unchanged in client-owned private storage and all reasonably available history is imported, targeting 12+ months and more when available.**

**• The 5:00 AM Pacific brief is generated from a complete or clearly qualified data snapshot and is available by email and in-app history; if it is Partial because source data is delayed, a newer revision is published automatically when the missing data later arrives and reconciles.**

**• AI answers use controlled tools, support authorized historical/reporting periods, show their period/location basis and supporting evidence where available, and disclose insufficient data.**

**•** Invoice OCR requires human confirmation before figures affect vendor or food-cost reporting.

**• Production deployment, backups, monitoring, source-code handover, runbooks, training and client ownership transfer are complete.**

# **2\. Business Context, Objectives and Success Measures**

## **2.1 Problem statement**

The owner and managers currently inspect multiple systems to understand restaurant performance. Important changes can be discovered late, comparisons are inconsistent, invoices and inventory are manually maintained, and business questions require time-consuming analysis. The Command Center must reduce that effort without presenting estimates as accounting facts or allowing AI to invent missing information.

## **2.2 Business objectives**

| Objective | V1 measure | Target / acceptance |
| :---- | :---- | :---- |
| **Morning visibility** | Executive brief availability | Target 5:00 AM Pacific; email \+ dashboard; historical briefs retained. |
| **Store control** | Daily score and ranking | Every eligible location receives a transparent daily score, rank, comparison and data-coverage indicator. |
| **Data trust** | Freshness and reconciliation | Views show source/freshness; unavailable data is not displayed as zero; daily POS totals reconcile within the tolerances defined in Section 9.3. |
| **Finance clarity** | Estimated metrics | Food-cost estimate and Estimated Profit at Selected Margin are clearly labeled, formula-documented and compared with configurable targets. |
| **Exception focus** | Alert usefulness | Only fixed, meaningful alert types fire; thresholds are Admin-configurable by location; duplicates are suppressed. |
| **Decision support** | AI grounding | Answers cite actual figures/context or state that the evidence is insufficient. |
| **Scalability** | Fourth location and future POS | New locations are configuration-driven; a future POS uses the same canonical contracts. |

# **3\. Version 1 Scope, Assumptions and Boundaries**

## **3.1 In scope**

**•** Email/password authentication, secure sessions, password reset, RBAC and location scoping.

**•** Owner/Admin and Manager roles; user, location, target, threshold, connector and notification settings.

**• Square live integration, Square historical backfill, one-time Toast historical export, cross-POS canonical mapping where appropriate, daily reconciliation and a POS-neutral canonical adapter contract.**

**• Executive Command Center, Executive Reporting Center, Store Performance, Operations, Finance, Forecasting, SEO & Growth and direct-order reporting with consistent relevant date-range controls.**

**• Google Search Console, Google Analytics 4 and Google Business Profile data; Google reviews only in V1, with provider-neutral SEO/review architecture for future third-party sources.**

**• Daily location score/ranking, overall business health score with configurable component weights, and simple comparable-history baselines.**

**•** Ask-the-AI with six controlled read-only tool families and transparent insufficiency handling.

**•** Fixed alert catalogue with Admin-configurable thresholds, in-app/email delivery and lifecycle history.

**• Morning Executive Brief at 5:00 AM Pacific, email \+ dashboard, with prior-brief history and automatic later revision when a Partial brief becomes complete.**

**• Invoice PDF/photo/email intake, OCR/vision extraction, human review, duplicate checks, item spend categories, reusable approved correction mappings and vendor price history.**

**•** Manual ingredient inventory for approximately 30–50 core/high-value items per location, low-stock warnings and days-remaining estimates.

**• MongoDB Atlas canonical model, client-owned private object storage, production deployment, monitoring, backups, testing, Light Mode, training and handover.**

## **3.2 Explicitly out of scope**

* Scheduled email reports from the Executive Reporting Center; this capability is reserved for V2. V1 supports on-screen, CSV and print-friendly/PDF-via-browser reporting.  
* POS menu-item stock read/write or menu availability write-back.  
* Recipe-level inventory depletion, perpetual inventory, automated reorder recommendations, purchase-order generation, supplier payments or inter-store transfer automation.  
* Payment processing, order placement, refunds, menu-price edits, payroll execution or accounting-ledger posting.  
* Cash Reconciliation, Deposit Tracking and Read-Only Bank Integrations; deferred to V2/SaaS.   
* Native iOS/Android applications; V1 is a responsive web application.

## **3.3 Key assumptions**

| ID | Assumption |
| :---- | :---- |
| **A-01** | The client owns and authorizes Square, Google, MongoDB Atlas, OpenAI, email, hosting, object-storage and domain accounts, and provides the Toast historical export before Toast is decommissioned. |
| **A-02** | Square data availability depends on the client’s account configuration, OAuth access and granted scopes. Required V1 scopes and representative data are validated before dependent features are accepted. |
| **A-03** | Square is the production POS in V1. |
| **A-04** | Each location has a configured timezone. Business-day boundaries use the location timezone with a 4:00 AM local cutoff; executive brief scheduling uses America/Los\_Angeles for the 5:00 AM Pacific target. |
| **A-05** | The client provides GA4 properties, Search Console sites, GBP locations and the access necessary to read them. |
| **A-06** | Direct-order reporting depends on reliable Square order source/fulfillment fields and a client-approved pre-go-live mapping for dine-in, takeout, delivery, third-party and direct online orders. Unreliable or unmapped channels remain unknown. |
| **A-07** | Managers maintain manual inventory quantities and units consistently. Days remaining is an estimate and does not automatically change on every sale. |
| **A-08** | Food-cost reporting in V1 is purchase-based and invoice-supported; it is not actual COGS. |
| **A-09** | Estimated Profit at Selected Margin uses a configurable selected-margin assumption, initially 15%, and is not a live P\&L. |
| **A-10** | The initial food-cost target is configurable by location and defaults to the client’s stated 20%–22% range. |
| **A-11** | Review replies always require Owner/Admin edit/approval/confirmation before posting. |
| **A-12** | AI is advisory. Users retain responsibility for business decisions and data correction. |
| **A-13**  | The client is responsible for all OpenAI API usage costs incurred during development and will provide or authorize access to a billing-enabled OpenAI account. |

## **3.4 Client dependencies and impact**

| Dependency | Required client input | Impact if unavailable |
| :---- | :---- | :---- |
| **Square OAuth access** | Square OAuth authorization, sandbox/test access, location mapping, required scopes and representative sample data. | Only authorized Square data is integrated; affected fields/modules show unavailable or partial status when required access is missing. |
| **Toast historical export** | Client-provided CSV/API dump before Toast is decommissioned; preserve the original export unchanged in client-owned private storage and import all reasonably available history, targeting 12+ months and more where available. | Historical coverage and comparable baselines are limited if the export is unavailable or incomplete. |
| **Google data** | GA4 property, Search Console site and GBP location access. | SEO/review/direct-conversion features are unavailable for the missing source. |
| **Direct-order mapping** | Order-source labels/channels and client approval of dine-in, takeout, delivery, third-party and direct online mappings before go-live. | Unreliable/unmapped channels remain unknown and direct-order volume/revenue is withheld rather than inferred. |
| **Business targets** | Food-cost target by location, estimated-margin target, alert thresholds and recipients. | Approved defaults are used and clearly labeled until updated. |
| **Invoice/vendor setup** | Initial vendor aliases, location mapping, food/spend categories, sample invoices and representative approved corrections. | OCR may require more manual corrections; vendor/category comparisons and reusable mappings remain limited. |
| **Inventory setup** | Initial 30–50 core items per location, units, par levels, costs and vendors. | Inventory screen can launch empty but warnings/estimates remain incomplete. |
| **Email/domain** | Verified sending domain, recipients and invoice-email intake approach. | Briefs/alerts remain in-app if outbound email is not ready; invoice email intake is delayed. |

# **4\. Users, Roles and Permissions**

## **4.1 Role model**

| Role | Data scope | Primary capabilities |
| :---- | :---- | :---- |
| **Owner/Admin** | All authorized Gourmet Palace locations and company-wide finance. | Manage users/locations/connections/targets/thresholds; view all dashboards; approve Google replies; run authorized syncs; view audit/system health. |
| **Manager** | Only assigned location(s); no company-wide finance or other locations. | View assigned operational dashboards and briefs; upload/review invoices; update manual inventory; acknowledge assigned alerts. |

## **4.2 Permission matrix**

| Capability | Owner/Admin | Manager | Condition |
| :---- | :---- | :---- | :---- |
| **Sign in / reset own password** | Yes | Yes | Active account; secure email link for reset. |
| **View Command Center / Store Performance / Operations** | All locations | Assigned locations | Every query applies location scope. |
| **View Finance, food-cost estimate and company ranking** | Yes | No | Restricted in UI, API, exports, alerts and AI. |
| **View Executive Reporting Center / exports** | Yes | No | Owner/Admin only; reports and exports remain within authorized data scope. |
| **Use Ask-the-AI** | All authorized data | Assigned operational data | Tool layer applies the same permissions. |
| **Manage users, locations, integrations and targets** | Yes | No | Changes are audited. |
| **Configure fixed alert thresholds** | Yes | No | No arbitrary rule builder in V1. |
| **Upload / correct / approve invoices** | All | Assigned locations | Approval history retained. |
| **Update manual inventory** | All | Assigned locations | Quantity, unit, date and user recorded. |
| **View vendors and price history** | All | Assigned location vendors | Cross-store comparison is Admin-only. |
| **View/draft/approve/post Google replies** | Yes | No | Explicit confirmation before external post. |
| **View SEO & Growth** | Yes | No | Admin-only baseline. |
| **Acknowledge/resolve alerts** | All | Assigned scope | Assignment/owner, lifecycle and notes are retained. |

## **4.3 Authorization rules**

**•** The API, not the browser, is the authorization boundary.

**•** Every data service receives organization, role and authorized-location context.

**•** Managers cannot enumerate another location through filters, exports, errors, notifications or AI prompts.

**•** Financial restrictions apply to raw fields, aggregates, alerts and derived answers.

**•** Object-storage links are short-lived and issued only after authorization.

**•** Permission changes take effect on the next request/session refresh and are recorded in audit history.

# **5\. User Flows, Navigation and Screens**

*![][image1]*

*Figure 1 — Daily data-to-decision flow*

## **5.1 First-time setup**

**1\.** The Owner/Admin account is created, and the login credentials are provided directly to the admin.

**2\.** Admin creates locations, timezones, user assignments, targets and notification preferences.

**3\. Admin connects Square and Google accounts; the system validates access without exposing credentials.**

**4\. Admin explicitly maps provider restaurants, properties, sites and locations to canonical Gourmet Palace locations and approves cross-POS item/channel mappings where required.**

**5\. A bounded Square historical backfill and the one-time Toast historical export are imported to establish comparable history; the original Toast export is retained unchanged in client-owned storage and the import uses all reasonably available history, targeting 12+ months and more where available.**

**6\.** Managers create the initial 30–50 core inventory items per location and enter current quantities/par levels.

**7\.** The readiness screen identifies available, partial and unavailable modules before go-live.

## **5.2 Normal daily operation**

**1\.** The pre-brief pipeline starts before 5:00 AM Pacific and imports the completed prior business day from available sources.

**2\.** Data is validated, normalized and reconciled into MongoDB.

**3\.** Daily KPIs, location scores, rankings, baseline comparisons, forecasts and eligible alerts are calculated deterministically.

**4\. The Morning Executive Brief is generated from a frozen evidence snapshot and published by the 5:00 AM Pacific target; if it is Partial, a newer revision is published automatically after the missing data arrives and reconciles, while the earlier revision remains in history.**

**5\.** Authorized users open the dashboard, review top priorities, drill into modules and ask controlled AI questions.

**6\.** Managers update manual inventory and review invoices; Admins review Google replies and configuration exceptions.

## **5.3 Screen inventory**

| Screen | Primary content/actions | Access |
| :---- | :---- | :---- |
| **Login / reset** | Email/password login, forgot/reset password and account-status guidance. | All active users |
| **Command Center** | Overall health score, yesterday KPIs, location score/ranking, priorities, alerts, freshness and relevant date/location controls. | All, scoped |
| **Store Performance** | Sales, ticket, orders, guests, channels, items/categories, refunds/voids/discounts and AI summary. | All, scoped |
| **Operations** | Operational comparisons, unusual activity and issue/opportunity summary. | All, scoped |
| **Finance** | Daily/weekly/MTD sales, comparisons, purchase-based food-cost estimate, Estimated Profit at Selected Margin, rankings and targets. | Owner/Admin |
| **Forecasting** | This-week baseline forecast, expected range and comparable history. | All, scoped |
| **Ask-the-AI** | Read-only chat, figures, evidence context and explicit data gaps. | All, scoped |
| **Alerts** | Open/history, reason, actual vs normal, threshold, acknowledge and resolve. | All, scoped |
| **Morning Brief** | Current and historical brief with top 3–5 priorities. | All, scoped |
| **Reporting Center** | Reports across store performance, sales, refunds/voids, food cost, vendors, invoices, inventory, reviews, SEO/direct orders, alerts, forecasting and AI summaries where data is available; CSV and print-friendly output. | Owner/Admin |
| **Reviews** | Google reviews, recurring themes, urgent items, draft/edit/approve/post reply. | Owner/Admin |
| **Invoices** | Upload/intake, OCR review, pending status, duplicate checks, source preview, item categories and approved correction mappings. | All, scoped |
| **Food Cost** | Purchase-based estimate, target comparison, invoice coverage and qualification. | Owner/Admin |
| **Inventory** | Manual item quantities, unit, par, days remaining, warning, history and responsible user. | All, scoped |
| **Vendors** | Vendor records and drill-down for total spend, invoices, purchased items, price history and significant price changes. | Admin; Manager scoped |
| **SEO & Growth** | GSC, GA4, GBP, direct orders and location-specific recommendations. | Owner/Admin |
| **Admin — Users/Locations** | Users, roles, assignments, locations, timezones and status. | Owner/Admin |
| **Admin — Integrations/Settings** | Connector status, source mapping, targets, fixed alert thresholds and notifications. | Owner/Admin |
| **Audit / System Health** | High-risk actions, pipeline status, source freshness and failures. | Owner/Admin |

Navigation placement: Reporting Center appears as a top-level Owner/Admin item in the main navigation immediately after Morning Brief.

UI theme: Light Mode is included in V1.

## **5.4 7:00 AM Owner experience**

**1\. On login, the Owner lands on the Command Center and sees data freshness/status, overall Business Health Score, yesterday’s core KPIs, location score/rank, top priorities and important alerts.**

**2\. Items needing attention are surfaced through the top 3–5 priorities and alerts covering sales, refunds/voids/discounts, vendor/cost, inventory, reviews, SEO/direct orders and forecasting where data is available.**

**3\. The Owner can drill into Store Performance, Finance, Vendors, Invoices, Inventory, Reviews, SEO & Growth, Forecasting and Reporting Center while retaining the selected date/location context.**

**4\. Ask-the-AI can answer authorized historical/reporting questions such as “Compare Q2 to Q1,” “Summarize July,” and “Show vendor spending for Woodland Hills over the last 90 days,” with supporting evidence and reliable financial impact where available.**

**5\. Available actions include acknowledging/resolving assigned alerts, reviewing/correcting/approving invoices, updating inventory, approving Google review replies and managing permitted settings. Morning Brief priorities remain informational in V1; the architecture preserves stable priority references so acknowledgement/completion can be added later.**

# **6\. Functional Specification by Module**

The requirements below define the V1 baseline. “System” means the responsive web application, Node.js/Express API and scheduled/background workers acting together. All behavior is subject to the permissions in Section 4 and the data-confidence rules in Section 3\.

## **6.1 Authentication and session security**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **AUTH-01** | Provide email/password as the only interactive V1 sign-in method. | No self-registration or social login is available; authorized users can sign in using credentials provided for their accounts.  |
| **AUTH-02** | Provision the initial Owner/Admin account and provide the login credentials directly to the authorized user.  | The Owner/Admin can sign in using the provided credentials. |
| **AUTH-03** | Provide forgot-password and reset-password flows. | A valid time-limited link changes the password; prior reset links are invalidated. |
| **AUTH-04** | Store passwords using an approved adaptive one-way hash and never log them. | Security tests confirm no plaintext/reversible password storage or logging. |
| **AUTH-05** | Use secure HTTP-only sessions with expiration, rotation and logout. | Expired, deactivated and logged-out sessions are rejected. |
| **AUTH-06** | Apply role and location scope to every authenticated request. | Cross-location and finance negative tests pass. |
| **AUTH-07** | Audit sign-in success/failure, password reset, account status and role changes. | Audit event includes actor/target, result, timestamp and correlation ID. |

## **6.2 User, location and settings administration**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **ADM-01** | List, create/invite, edit, activate and deactivate users; assign roles and locations. | Deactivation blocks new requests while preserving historical authorship. |
| **ADM-02** | Create/edit locations with name, address, timezone, status and external mappings. | A deactivated location retains historical data and cannot receive new syncs. |
| **ADM-03** | Configure food-cost target by location, initially 20%–22%, and estimated operating-margin target, initially 15%. | Effective values and dates are visible; changes do not silently rewrite old snapshots. |
| **ADM-04** | Configure the fixed alert types using enable/disable, threshold, severity, recipient and cooldown fields. | A changed threshold is used by subsequent evaluations and is recorded in audit history. |
| **ADM-05** | Configure notification channel/preferences and brief recipients. | Email/in-app routing follows role, location and subscription settings. |
| **ADM-06** | Show connector health, entitlement/capability, last success, lag and actionable error without secrets. | Unavailable capability is clearly distinguished from a failed job. |
| **ADM-07** | Allow Owner/Admin to configure the score component weights defined in Section 11.2. | The configured weights are used by subsequent score calculations and are visible with the score inputs. |

## **6.3 POS ingestion (Square), Toast historical export, backfill & reconciliation**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **POS-01** | Validate Square OAuth connection, locations, granted scopes and required data availability before enabling a dependent module. | Readiness shows READY, PARTIAL or UNAVAILABLE per capability. |
| **POS-02** | Run a bounded, resumable Square historical backfill for the client-approved date range. | A retry resumes safely and does not duplicate canonical orders. |
| **POS-03** | Import available Square orders/checks/items, gross/net sales, refunds, voids, discounts, order/fulfillment source and guest count where available. | Each fact includes provider ID, location, business date, source timestamp and ingest timestamp. |
| **POS-04** | Normalize Square live data and Toast historical data into the same provider-neutral canonical records where appropriate. | Provider IDs/names remain traceable; approved aliases/mappings may connect differing Toast/Square item names or IDs to one canonical record, while uncertain matches remain unmapped. |
| **POS-05** | Reconcile daily counts and financial totals against available Square control totals. | A day is marked complete only when the required controls pass the tolerances defined in Section 9.3. |
| **POS-06** | Expose partial/stale/unavailable status in every screen dependent on live Square or historical source data. | Missing data is not displayed as zero and does not produce a normal-performance alert. |
| **POS-07** | Keep imported source facts immutable except through traceable reprocessing. | A correction creates a new processing version and audit record. |
| **POS-08** | Import a bounded Toast historical export (client-provided CSV/API dump) before Toast is decommissioned; import all reasonably available history, targeting 12+ months and more where available. | The original export is retained unchanged in client-owned private storage; imported history is source-labeled as Toast, deduplicated into canonical history and is never treated as a live Toast connector. |
| **POS-09** | Require client approval of the final Square channel mapping before go-live for dine-in, takeout, delivery, third-party and direct online orders. | Representative Square data validates the approved mapping; any unreliable/unmapped channel remains Unknown and is not guessed. |

## **6.4 Executive Command Center**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **CMD-01** | Show overall business health score, score coverage and change versus the prior comparable day. | The score links to its deterministic inputs and formula version. |
| **CMD-02** | Show yesterday’s total gross/net sales, order count, average ticket and available guest count. | Each value shows period, comparison and freshness. |
| **CMD-03** | Show every eligible location’s daily score and rank, including best and weakest location. | Ranking is reproducible from stored location-score inputs. |
| **CMD-04** | Show the top three to five priorities with affected location, evidence and suggested next action. | No priority contains a number absent from the frozen evidence snapshot. |
| **CMD-05** | Show important refunds/voids/discounts, cost/vendor concerns, review issues, SEO/direct-order changes and forecast summary when available. | Unavailable categories are omitted or explicitly marked—not invented. |
| **CMD-06** | Allow date/location filtering and drill-through within authorized scope; relevant analytical screens support Yesterday, 7 Days, 30 Days, WTD, MTD, YTD, prior-year comparison and Custom Range. | Selected filter context is preserved across drill-through; unavailable comparison history is labeled rather than estimated and permission is rechecked at the destination. |

## **6.5 Store Performance and Operations**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **OPS-01** | Show gross sales, net sales, average ticket, transaction/order count and reliable guest count. | Definitions match Appendix A and unavailable guest data is labeled. |
| **OPS-02** | Show dine-in, takeout, delivery and direct-online-order breakdown when source/channel data is reliable. | Unmapped/unknown channel remains visible and is not guessed. |
| **OPS-03** | Show top-selling and slow-selling items plus sales by menu category. | Ranking basis (units or revenue) and selected period are visible. |
| **OPS-04** | Show refunds, voids and discounts with comparison to normal and order-level drill-down where permitted. | Sensitive payment details are never displayed or stored. |
| **OPS-05** | Compare each store with its own comparable history and with other Gourmet Palace locations. | Comparison uses the selected date range and authorized locations. |
| **OPS-06** | Display daily location score/rank and a one-line AI summary with one key issue or opportunity. | Summary does not contradict displayed KPIs and falls back to a deterministic template. |

## **6.6 Finance dashboard**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **FIN-01** | Show daily, weekly and month-to-date gross/net sales. | Exact POS-derived values show reconciliation and freshness. |
| **FIN-02** | Compare with previous day, week, month and prior-year period when data exists. | Unavailable comparison periods are labeled; no extrapolated prior-year value is shown. |
| **FIN-03** | Show store rankings plus sales and Estimated Profit at Selected Margin trends. | Ranking criteria and period are visible. |
| **FIN-04** | Show refunds, discounts and voids with values and rates. | Values match Store Performance for the same scope/period. |
| **FIN-05** | Calculate purchase-based food-cost estimate \= approved food/ingredient invoice spend ÷ net sales for the same period/location. | Metric is labeled “Estimated / purchase-based, not actual COGS” and shows invoice coverage. |
| **FIN-06** | Compare food-cost estimate with a configurable location target, initially 20%–22%. | Target source/effective date and variance are visible. |
| **FIN-07** | Calculate Estimated Profit at Selected Margin \= net sales × configured selected margin, initially 15%. | Metric is labeled “Estimated Profit at Selected Margin”; the selected margin and assumptions are shown; no live-P\&L claim is made. |
| **FIN-08** | Allow menu-item margin answers only where a validated item-cost mapping exists. | Otherwise the screen/AI states that margin evidence is insufficient. |
| **FIN-09** | Restrict finance data to Owner/Admin. | Managers cannot access finance through UI, API, export, alert or AI. |

## **6.7 SEO, Google performance and direct orders**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **SEO-01** | Map GA4 properties, Search Console sites and GBP locations to canonical locations. | Unmapped resources do not enter location reporting. |
| **SEO-02** | Show GA4 traffic and configured website conversion metrics. | Metric/dimension combinations are valid and data lag is displayed. |
| **SEO-03** | Show Search Console clicks, impressions, CTR, average position, queries and pages. | The product labels average position as Search Console performance, not a third-party exact rank tracker. |
| **SEO-04** | Show GBP performance for each mapped location and Google review signals. | Only metrics available through the connected account/API are shown. |
| **SEO-05** | Show direct online-order volume and revenue by location from reliable Square order source/fulfillment data. | A documented Square mapping defines direct orders; otherwise the metric is unavailable. |
| **SEO-06** | Compare organic traffic and direct-order performance without claiming causation. | The UI states that correlation is not attribution unless an approved join exists. |
| **SEO-07** | Surface declining queries/pages/locations and location-specific recommendations. | Each recommendation shows supporting period, metric and confidence. |
| **SEO-08** | Keep SEO and review integration contracts provider-neutral so future third-party SEO ranking tools and additional review platforms such as Yelp can be added without rebuilding the core reporting model. | V1 live integrations remain the approved Google sources; future providers plug in through the adapter/mapping boundary rather than changing canonical reporting contracts. |

## **6.8 Google reviews and reply approval**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **REV-01** | Import Google Business Profile reviews for mapped locations. | Upsert prevents duplicates and preserves provider IDs/update times. |
| **REV-02** | Show review rating/text/date/location, response status and source link. | Access is Owner/Admin only. |
| **REV-03** | Summarize recurring complaints, themes, rating movement and urgent reviews. | Low sample volume is disclosed and source reviews remain accessible. |
| **REV-04** | Draft a reply using approved brand tone and review context. | Draft is never posted automatically. |
| **REV-05** | Require Owner/Admin edit/approve/confirm before posting to Google. | Audit records draft, approved text, actor, provider result and time. |
| **REV-06** | Create an alert for a configured urgent/negative review. | Alert links to the review and respects threshold/recipient settings. |

## **6.9 Invoice OCR, vendors and price intelligence**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **INV-01** | Accept PDF/JPG/PNG invoice upload and configured invoice-email intake. | Allowed type/size checks pass and original is stored privately. |
| **INV-02** | Extract vendor, invoice number/date, location, totals, line items and item category candidates into a structured schema. | Fields show confidence and source-page reference; category is reviewable before approval. |
| **INV-03** | Require human review/correction before approval. | No unapproved invoice affects vendor, ingredient or food-cost reports. |
| **INV-04** | Detect duplicate candidates using file hash and business fields. | Potential duplicates require explicit disposition. |
| **INV-05** | Maintain PENDING\_REVIEW, APPROVED, REJECTED and FAILED states. | Ask-the-AI can list pending invoices from the authoritative workflow state. |
| **INV-06** | On approval, update vendor-item/ingredient price history. | The observation links to the approved invoice, unit and effective date. |
| **INV-07** | Provide Vendor Intelligence drill-down showing total approved spend, invoices, purchased items, normalized price history and significant price changes, including cross-store/vendor comparison where units are comparable. | The selected period/location is shown; price observations link to approved source invoices and unreliable comparisons are withheld. |
| **INV-08** | Validate OCR extraction against client-provided real invoices. High-risk fields—totals, invoice numbers and dates—require 100% human confirmation. | Overall field extraction accuracy is at least 90% before acceptance, and every high-risk field is human-confirmed before approval. |
| **INV-09** | Categorize approved invoice line items into spend categories such as meat, seafood, produce, packaging and other configured categories so spend can be reported by category. | Category spend reports use approved invoice items only and retain source invoice/location/period context. |
| **INV-10** | Retain approved OCR/item/unit corrections as reusable mappings for future invoices. | When a known vendor/item pattern recurs, the approved mapping may be reused as the starting interpretation; the new invoice still requires the existing human review/approval workflow. |

## **6.10 Manual ingredient inventory**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **STK-01** | Maintain approximately 30–50 core/high-value inventory items per location. | Admin/Manager can create/edit an item with location, name and status. |
| **STK-02** | Store unit of measurement, current quantity, minimum/par level, ingredient cost and primary vendor. | Required fields validate and cost/vendor can link to approved invoice history. |
| **STK-03** | Record last update date and responsible user for every quantity change. | History retains old/new quantity, unit, actor and timestamp. |
| **STK-04** | Calculate estimated days remaining from current quantity and an approved average-usage estimate. | Formula and usage source are displayed; zero/unknown usage yields unavailable. |
| **STK-05** | Support a simple usage estimate based on manual history and/or selected sales correlation where possible. | Sales may inform an estimate but never automatically decrements on-hand quantity. |
| **STK-06** | Create low-stock/critical inventory warnings using par level or days-remaining threshold. | Threshold is configurable within the fixed inventory alert type. |
| **STK-07** | Show inventory history by item/location. | Authorized users can filter changes and identify the responsible person. |
| **STK-08** | Support CSV import and export for inventory. | Authorized users can export scoped inventory and import a valid CSV using the documented template. |
| **STK-09** | Support bulk updates to inventory quantities and editable count fields. | Authorized users can update multiple scoped items in one action; saved changes retain item-level update history. |
| **STK-10** | Allow users to copy the previous inventory count as the starting point for a new count. | Copied values are reviewable/editable before save and the new count records its own user and timestamp. |
| **STK-11** | Provide mobile-friendly inventory entry for core count and update actions. | Inventory count/edit flows are usable on supported mobile web layouts without requiring the desktop layout. |
| **STK-12** | Provide inventory search and filtering. | Authorized users can search/filter by item and permitted location/status while location scope remains enforced. |
| **STK-13** | Flag stale inventory counts and show when/by whom the count was last updated. | Counts older than the documented freshness rule are clearly marked stale; STK-11 mobile count/update behavior remains available. |

| INVENTORY BOUNDARYInventory V1 is manual ingredient stock logging. It is not POS menu-item availability, perpetual inventory or recipe depletion. No purchase order, reorder recommendation or transfer is created automatically. |
| :---- |

## **6.11 Location score, ranking and forecasting**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **ANA-01** | Build normal-performance baselines separately by location and day of week from complete comparable history. | Baseline stores comparison dates, expected value, coverage and version. |
| **ANA-02** | Calculate a 0–100 daily location score using transparent weighted components whose Section 11.2 default weights are Owner/Admin configurable. | Inputs, configured/effective weights and missing-data coverage are stored/displayed. |
| **ANA-03** | Rank eligible locations by daily score. | Best/weakest labels match the stored ranking; tied results are clearly indicated. |
| **ANA-04** | Calculate overall business health as the sales-weighted average of eligible location scores. | Coverage and excluded locations are shown; missing data is not scored as zero. |
| **ANA-05** | Produce a simple this-week sales forecast using comparable weekdays and recent trend. | Forecast shows expected value/range and is labeled provisional when history is insufficient. |
| **ANA-06** | Do not create a performance anomaly when source quality is insufficient. | A data-quality/system alert is created instead where appropriate. |

## **6.12 Ask-the-AI**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **CHAT-01** | Classify the user’s question and expose only the controlled tools allowed by role/location scope. | A Manager cannot call company-finance or other-location tools. |
| **CHAT-02** | Use six server-defined tool families; do not execute unrestricted model-generated MongoDB queries. | Every tool validates dates, locations, result limits and access context. |
| **CHAT-03** | Answer with actual period/location figures and clear evidence context. | The response identifies relevant scope, source freshness and key figures. |
| **CHAT-04** | State when data is insufficient, unavailable or stale. | Unsupported questions do not receive invented or generic business claims. |
| **CHAT-05** | Keep chat read-only and prevent review posting, inventory changes or other external mutation. | Adversarial prompts cannot trigger writes. |
| **CHAT-06** | Retain conversation history and feedback within authorized scope. | Sensitive content is minimized and trace metadata excludes credentials. |
| **CHAT-07** | Support authorized longer-period and reporting-data questions through the controlled tool layer, including period-versus-period and selected-range analysis. | Representative questions include “Compare Q2 to Q1,” “Summarize July,” and “Show vendor spending for Woodland Hills over the last 90 days”; unavailable history is disclosed. |
| **CHAT-08** | Allow AI answers to drill into supporting evidence where the authorized source is available and show financial impact when it can be reliably calculated. | Evidence references preserve scope/freshness; unreliable impact is withheld and estimated figures retain their estimate labels. |

| Controlled tool family | Questions covered |
| :---- | :---- |
| **1\. Business performance** | Yesterday by location; location needing attention; biggest changes; top 3–5 actions; daily score/ranking. |
| **2\. Menu performance** | Highest revenue items; underperforming items; apparent margin only where validated cost mapping exists. |
| **3\. Exceptions** | Discount/refund/void comparison; unusual activity; alert evidence. |
| **4\. Cost, vendor, invoice & inventory** | Vendor/ingredient price increases; vendor spend over selected periods; food-cost estimate; pending invoices; low/critical stock. |
| **5\. Reviews, SEO & direct orders** | Recurring complaints; urgent reviews; direct-order trend; SEO opportunities. |
| **6\. Forecast & comparison** | Expected sales this week; compare authorized locations or periods over a selected date range; summarize a selected month/quarter when data is available. |

## **6.13 Alerts and notifications**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **ALT-01** | Evaluate data quality, baseline, configured threshold, scope, cooldown and deduplication before opening an alert. | Repeated equivalent signals update one alert occurrence rather than create noise. |
| **ALT-02** | Support the fixed business alert catalogue in Table 6-1. | Admin can enable/disable and configure values; no arbitrary formula builder is required. |
| **ALT-03** | Store severity, actual, normal/target, delta, affected location/resource, owner/assignee, notes, supporting evidence references and lifecycle. | OPEN → ACKNOWLEDGED → RESOLVED/DISMISSED transitions, assignment and notes are audited; supporting evidence is drillable where permitted and reliable financial impact is shown when calculable. |
| **ALT-04** | Route in-app and email by role/location, configured recipients and notification preferences. | Unauthorized recipients never receive restricted data. |
| **ALT-05** | Separate source/data-quality failures from business-performance alerts. | A stale source does not generate a false sales/operational alert. |

| Fixed alert type | Default signal (configurable) | V1 note |
| :---- | :---- | :---- |
| **Sales below normal** | Percent and/or dollar decline versus location/day-of-week baseline. | Per-location threshold. |
| **Refunds / voids / discounts above normal** | Rate or value materially above baseline. | Can display subcategory evidence. |
| **Average ticket dropping** | Percent decline versus comparable baseline. | Requires valid order count. |
| **Location underperforming peers** | Score/rank gap or sales deviation versus other locations. | Admin-only company comparison. |
| **Urgent negative review** | Rating/keyword/priority threshold. | Google reviews only. |
| **Vendor / ingredient price increase** | Normalized unit-price increase above threshold. | Approved invoices only. |
| **Food cost above target** | Purchase-based estimate exceeds configured range. | Labeled estimate, not actual COGS. |
| **Direct orders declining** | Volume/revenue decline versus comparable baseline. | Only when channel mapping is reliable. |
| **Inventory approaching critical** | Quantity below par or days remaining below threshold. | Manual quantity remains source of truth. |
| **System / data quality** | Sync, entitlement, mapping, stale-source or delivery failure. | Operational alert, not business performance. |

## **6.14 Morning Executive Brief**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **BRF-01** | Publish the prior-business-day Morning Executive Brief at the 5:00 AM Pacific target. Business dates are determined per configured location timezone using a 4:00 AM local cutoff. | Pre-brief jobs start before the target; actual publish timestamp, business date and data snapshot are stored. |
| **BRF-02** | Deliver by email and make the same brief available in the dashboard. | Both channels link to the same immutable brief date/scope. |
| **BRF-03** | Maintain history of previous briefs within user authorization scope. | Users can open prior brief dates; Managers never see other locations. |
| **BRF-04** | Include overall health, sales, store-by-store score/rank, normal comparison, best/weakest store, exceptions, cost/vendor, reviews, SEO/direct orders, forecast and top 3–5 priorities when available. | Every included figure exists in the evidence snapshot; missing categories are qualified. Each priority retains a stable reference so future acknowledgement/completion state can be linked without rewriting the published brief; that priority action workflow is not required for V1. |
| **BRF-05** | Use deterministic fallback content if AI drafting fails. | The brief remains available and a system alert records the drafting/email issue. |
| **BRF-06** | Handle delayed source data transparently. | If source data is delayed, the brief is marked “Partial”; incomplete data is never presented as final. Freshness and affected source coverage are shown. |
| **BRF-07** | Automatically refresh a published Morning Brief that is marked Partial when the missing source data later arrives and successfully reconciles. | A newer revision for the same business date/scope becomes current and shows its updated time/status; the earlier 5:00 AM revision remains retained in brief history. |

## **6.15 Executive Reporting Center**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **RPT-01** | Provide a daily executive report using the approved Morning Brief content and supporting figures; make it viewable and exportable. | Owner/Admin can open the selected daily report and export the same scoped report content. |
| **RPT-02** | Provide weekly and monthly aggregate reports for authorized locations and company scope. | Selected week/month totals and comparisons are generated from published canonical data and show the reporting period. |
| **RPT-03** | Provide store scorecards for each eligible location. | Scorecards show the selected period, location score/rank, core KPI context and data-coverage status. |
| **RPT-04** | Provide invoice and vendor intelligence reports. | Owner/Admin can review vendor spend by period/location, vendor drill-down, invoices, purchased items, approved invoice history, category spend and significant price changes; results respect approval state and authorization. |
| **RPT-05** | Provide inventory reports. | Owner/Admin can review scoped inventory quantities/status, low-stock indicators and update freshness for the selected period/current state. |
| **RPT-06** | Provide CSV export for supported Reporting Center reports. | CSV output respects report filters, data scope and authorization. |
| **RPT-07** | Provide a print-friendly report layout with PDF output through browser print. | Supported reports render in a print-friendly layout suitable for browser Print / Save as PDF. |
| **RPT-08** | Scheduled email reports are reserved for V2 and are out of scope for V1. | No scheduled Reporting Center email workflow is required for V1 acceptance. |
| **RPT-09** | Where data is available, combine store performance, sales, refunds/voids, purchase-based food cost, vendors, invoices, inventory, reviews, SEO/direct orders, alerts, forecasting and AI summaries within the Reporting Center. | Reports use the selected authorized scope/date controls and retain the applicable freshness, confidence and financial-estimate labels. |
| **RPT-10** | Submit the Reporting Center wireframe to the client for review before Reporting Center implementation begins. | Reporting Center implementation starts after the client approves the wireframe or provides written approval to proceed. |

## **6.16 Audit, history and system health**

| ID | V1 functional requirement | Acceptance condition |
| :---- | :---- | :---- |
| **AUD-01** | Audit authentication, role/location changes, target/threshold changes, invoice approval, inventory updates and review posting. | Event records actor, action, target, result, time and correlation ID. |
| **AUD-02** | Do not log passwords, reset tokens, provider secrets, full invoice content or payment card data. | Automated redaction/secret checks are included in testing. |
| **AUD-03** | Show job freshness, entitlement/capability, reconciliation variance, OCR/AI failure and email status to Admin. | An Admin can identify the failed source/job and recommended action. |
| **AUD-04** | Provide runbooks for provider outage, failed import, revoked credentials, OCR backlog and failed morning brief. | Operational handover includes an executed walkthrough/test. |

# **7\. Technical Architecture![][image2]**

*Figure 2 — Logical system architecture*

## **7.1 Architecture decisions**

| Layer | V1 technology | Responsibility / boundary |
| :---- | :---- | :---- |
| **Web application** | Next.js (React) on Vercel | Responsive application, dashboards and workflows. No provider secrets in browser. |
| **API** | Node.js / Express | Authentication, authorization, validation, business services, controlled AI tools and signed object URLs. |
| **System of record** | MongoDB Atlas | Canonical business data, configuration, aggregates, workflows, audit and optional search indexes. |
| **Private object storage** | Private S3-compatible object storage | Encrypted invoice originals, derived images and the original Toast export archive; short-lived authorized URLs where application access is required. |
| **Job scheduling and coordination**  | Job scheduling uses cron-based workers with MongoDB job tracking; no separate queue vendor is required.  | Runs automatic daily ingestion, calculations, alert evaluation, Morning Brief generation and scheduled email delivery.  |
| **AI** | OpenAI via server-side integration | Structured tool calling, summaries, recommendations, review drafts and OCR/vision assistance. |
| **Email** | Resend | Morning briefs, alerts, account activation/reset and delivery events. |
| **Edge** | Cloudflare | DNS, TLS/CDN and appropriate edge protections. |
| **Source control** | GitHub | Client-owned GitHub repositories from day 1, continuous commits, reviewable history and ownership handover. |

## **7.2 Component boundaries**

**•** Controllers/routes handle HTTP contract and validation; they do not contain dashboard formulas.

**•** Application services orchestrate use cases and permission checks.

**•** Domain/calculation services implement deterministic KPIs, estimates, scores, baselines and alert rules.

**•** Repositories are the only normal path to MongoDB and require access context.

**• Provider adapters isolate Square/Google authentication, pagination, rate limits and field mapping; the Toast historical export uses a bounded historical-import path rather than a live connector. SEO/review contracts remain provider-neutral so future third-party ranking tools and review platforms such as Yelp can be added through adapters without rebuilding the core reporting model; they are not live V1 integrations.**

**•** AI code can call only approved service tools and cannot directly access unrestricted collections.

**•** Workers are idempotent and persist business state before external side effects.

## **7.3 Deployment topology**

**•** Separate development, staging and production environments with separate data and credentials.

**•** Frontend deployed to Vercel; API and workers deployed to a client-approved managed container platform.

**• MongoDB Atlas staging is isolated from production. Production backups use MongoDB Atlas Cloud Backup with point-in-time recovery on the selected production plan; invoice object storage uses provider-supported versioning/retention.**

**•** Invoice buckets are private and separated by environment.

**• Job scheduling uses cron-based workers with MongoDB job tracking; no separate queue/cache vendor is required.**

**• Monitoring uses Vercel monitoring/logs for the web app, managed-container health checks/logs for API/workers, MongoDB Atlas monitoring/alerts for the database and job persistence, and Resend delivery events for email.**

# **8\. POS Abstraction, Square Entitlements and External Data**

*![][image3]*

*Figure 3 — POS abstraction and ingestion flow*

## **8.1 V1 POS boundary**

Square is implemented as the live production POS in V1. Toast is historical-only and provides a one-time client-provided export before decommissioning. A canonical POS adapter contract separates provider-specific acquisition and mapping from downstream dashboards, calculations and AI so the core platform remains provider-neutral; approved Toast and Square item/source aliases may map to the same canonical records where appropriate while retaining source provenance.

## **8.2 Square entitlement and Toast historical-export constraint**

| CRITICAL DEPENDENCY  Square OAuth and sandbox/test access must be available with the required scopes before dependent V1 features are accepted. The Toast historical export must be obtained before Toast is decommissioned; if either dependency is missing, affected capabilities/history are shown as partial or unavailable rather than estimated. |
| :---- |

| Capability | Required V1 outcome | Required access / fallback |
| :---- | :---- | :---- |
| **Orders / sales** | Live Square orders, gross/net sales, order counts, refunds, voids and discounts. | Square OAuth: ORDERS\_READ and PAYMENTS\_READ; if unavailable, affected KPI/module is unavailable. |
| **Items / catalog** | Read item/catalog data required for item/category reporting. | Square OAuth: ITEMS\_READ; unavailable item detail is labeled and not inferred. |
| **Inventory read** | Read available Square inventory reference data where used, without replacing manual ingredient inventory. | Square OAuth: INVENTORY\_READ; manual ingredient inventory remains the V1 source of truth and no menu-stock write-back is implied. |
| **Employee reference** | Read employee reference data only where needed for authorized source attribution. | Square OAuth: EMPLOYEES\_READ; no payroll or HR workflow is implied. |
| **Payout reference** | Read payout information where required for supported reconciliation/control context. | Square OAuth: PAYOUTS\_READ; no accounting-ledger or live P\&L feature is implied. |
| **Direct-order / fulfillment source** | Use Square order source/fulfillment fields to classify dine-in, takeout, delivery, third-party and direct online orders. | Requires reliable client-approved Square source/fulfillment mapping before go-live; unknown remains visible and affected metrics are withheld if unmapped. |
| **Toast historical export** | Import the client-provided historical CSV/API dump before decommissioning, using all reasonably available history; target 12+ months and more where available. | Original export is retained unchanged in client-owned private storage; if unavailable, historical coverage/baselines remain limited or provisional. |

## **8.3 External data automation versus manual setup**

| Source / data | Automatic after connection | Manual/configuration required |
| :---- | :---- | :---- |
| **Square sales and item data** | Daily live import/backfill within granted Square scopes. | Square OAuth/location mapping, sandbox access and approved historical window. |
| **Square direct-order data** | Volume/revenue when reliable Square order source/fulfillment data is exposed. | Client approves dine-in, takeout, delivery, third-party and direct-online mappings before go-live; unresolved channels stay unknown. |
| **Toast historical export** | One-time historical import into canonical history; no live Toast sync. | Preserve the original export unchanged in client-owned private storage and import all reasonably available history, targeting 12+ months and more where available. |
| **Google Analytics 4** | Traffic and configured conversion metrics. | Property mapping, access and correct conversion/e-commerce event configuration. |
| **Search Console** | Clicks, impressions, CTR, average position, queries and pages. | Site mapping; no manual daily data entry. |
| **Google Business Profile** | Available performance metrics and reviews. | Account/location mapping and API access. |
| **Invoices** | OCR extraction and duplicate/price processing after intake. | Upload/email forwarding plus human confirmation/correction. |
| **Inventory** | Days-remaining calculation and warnings after entry. | Manual current quantity, unit, par, vendor/cost and periodic updates. |
| **Targets/thresholds** | Used automatically in calculations/alerts. | Owner/Admin enters and approves values. |

# **9\. Data Ingestion, Scheduling and Reconciliation**

## **9.1 Daily job graph and schedule**

| Stage | Default timing (Pacific) | Outcome |
| :---- | :---- | :---- |
| **Acquire** | Starts before 5:00 AM; initial default window begins around 3:30 AM and is configurable after runtime testing. | Pull the completed prior business day from Square/Google using each location timezone and 4:00 AM cutoff; accept queued invoice/review updates. |
| **Normalize & reconcile** | After acquisition | Validate, map to canonical records, compare control totals and assign data status. |
| **Calculate** | After required data is publishable | KPIs, purchase-based food cost, location scores/rank, baseline comparisons, forecast and alert candidates. |
| **Draft** | Before 5:00 AM target | Generate priorities and Morning Executive Brief from a frozen evidence snapshot. |
| **Publish** | Target 5:00 AM Pacific | Atomically publish dashboards/brief and route email/in-app notifications. |

*The exact pre-brief start time may be tuned during staging based on measured provider latency and data volume. The client-facing commitment in this specification is the 5:00 AM Pacific target, not a permanently hardcoded acquisition start time.*

## **9.2 Job controls**

**•** One logical job per source, location and business date with a stable idempotency key.

**•** Bounded retry with backoff for transient provider/email/AI failures.

**• Resumable Square historical backfill in date windows; Toast history is imported once from the client-provided export, using all reasonably available history, targeting 12+ months and more where available; the original export remains unchanged in client-owned storage.**

**•** Atomic dashboard publication: incomplete recalculation does not replace the last good snapshot.

**•** Explicit COMPLETE, PARTIAL, FAILED and UNAVAILABLE data states.

**• If a published Morning Brief is PARTIAL and the missing source later arrives and reconciles, dependent calculations re-run and a newer brief revision is published automatically while the earlier revision remains in history.**

**•** Admin-visible manual re-run for a selected source/location/date without duplicating facts.

## **9.3 Reconciliation controls**

| Control | Comparison | Result |
| :---- | :---- | :---- |
| **Order count** | Canonical unique orders vs available Square/provider control total. | Exact match required (zero order-count variance). |
| **Net sales** | Canonical net sales vs available Square/provider control total. | Variance must be within ±0.5% or $5, whichever is greater. |
| **Refund/void/discount** | Imported values/rates vs Square/provider totals where available. | Variance must be within ±1% or $3; outside tolerance creates a data-quality status. |
| **Channel totals** | Known channel subtotal \+ unknown equals total. | Unknown remains visible; no forced mapping. |
| **Invoice totals** | Line/subtotal/tax/total arithmetic. | Mismatch requires review. |

# **10\. MongoDB Data Model**

*![][image4]*

*Figure 4 — MongoDB logical data model*

## **10.1 Modeling rules**

**•** Every business record includes organizationId and relevant locationId to enforce scope and indexing.

**•** Money is stored in integer minor units with ISO currency code.

**•** Source facts retain provider IDs, raw provenance reference, source timestamp, ingest timestamp and processing version.

**•** Calculated snapshots retain formula version, input references, coverage and data status.

**•** Workflow records (invoice, alert, review reply, inventory update) retain lifecycle and actor history.

**•** Provider credentials are stored through a managed secret store; MongoDB stores only non-secret connection metadata/reference.

## **10.2 Core collection catalogue**

| Collection group | Purpose |
| :---- | :---- |
| **organizations** | Brand/account settings, targets, currency and brief timezone. |
| **users / memberships** | Email identity, password hash reference/state, role, locations and notification preferences. |
| **locations** | Canonical restaurants, timezone and external source mappings. |
| **connections / capabilities** | Square/Google connection metadata, OAuth/capability status, mapped resources and Toast historical-import metadata. |
| **raw\_ingest\_events** | Provider payload references/envelopes and processing status. |
| **orders / order\_items** | Canonical order/item/channel/refund/void/discount facts with provider source IDs and approved cross-POS aliases/mappings where appropriate. |
| **daily\_metrics** | Daily/location KPIs, comparisons, source coverage and reconciliation status. |
| **location\_scores** | Daily score components, weights, coverage and rank. |
| **forecasts / baselines** | Comparable history, expected values/ranges and model/formula version. |
| **invoices / invoice\_items** | OCR fields, review state, approved values, spend category and source references. |
| **vendors / vendor\_items / price\_observations** | Vendor aliases, normalized units, approved price history and reusable approved OCR/item/unit correction mappings. |
| **inventory\_items / inventory\_updates** | Manual quantity, unit, par, usage estimate, days remaining and history. |
| **reviews / review\_reply\_actions** | Provider-tagged review content, themes and controlled reply workflow; V1 live review provider is Google Business Profile. |
| **seo\_daily\_metrics** | Provider-tagged SEO/performance aggregates for GA4, Search Console, GBP and direct orders; adapter-ready for future approved providers. |
| **alerts / alert\_events** | Fixed-rule evidence, threshold, severity, owner/assignee, notes, evidence references and lifecycle. |
| **briefs** | Immutable Morning Brief evidence/rendered revisions per date/scope, including current revision status and stable priority references. |
| **chat\_sessions / chat\_messages / ai\_traces** | Authorized chat history and controlled tool trace references. |
| **audit\_events / job\_runs** | Security/business controls and operational job history. |

## **10.3 Index baseline**

| Collection | Key indexes |
| :---- | :---- |
| **orders** | Unique organization \+ provider \+ providerOrderId; organization \+ location \+ businessDate. |
| **daily\_metrics** | Unique organization \+ location \+ businessDate \+ metricVersion. |
| **location\_scores** | Unique organization \+ location \+ businessDate \+ scoreVersion; organization \+ businessDate \+ rank. |
| **invoices** | Organization \+ location \+ status \+ invoiceDate; unique/partial vendor \+ invoice number; content hash. |
| **inventory\_updates** | Organization \+ location \+ item \+ updatedAt descending. |
| **alerts** | Organization \+ status \+ severity \+ createdAt; unique active dedupe key. |
| **briefs** | Organization \+ user/scope \+ businessDate unique. |
| **audit\_events** | Organization \+ createdAt; actor \+ createdAt; correlationId. |

# **11\. AI, Analytics, Scoring and Forecasting**

*![][image5]*

*Figure 5 — Controlled Ask-the-AI and analytics flow*

## **11.1 Non-negotiable AI rules**

**•** Deterministic services calculate all numeric truth; the language model narrates or explains those results.

**•** The model cannot run unrestricted MongoDB code or invent a missing metric.

**•** Every tool call is server-defined, schema-validated, role-scoped and location-scoped.

**•** Chat is read-only. Review posting and data changes remain dedicated application workflows.

**•** When a required field or history is unavailable, the answer states the limitation and identifies what data is needed.

**•** AI outputs are labeled advisory and retain tool/evidence trace references for support and evaluation.

## **11.2 Location score formula**

| Component | Default weight | Evidence |
| :---- | :---- | :---- |
| **Sales performance** | 40% | Net sales versus same-location comparable weekday/target. |
| **Demand quality** | 25% | Order count and average ticket versus comparable baseline. |
| **Exception control** | 20% | Refund, void and discount rates relative to normal. |
| **Available operating signal** | 15% | Reliable guest/direct-order/other approved operational indicator. |

*The listed values are V1 default component weights and are configurable by Owner/Admin. If a component is unavailable, its configured weight is redistributed proportionally across eligible components and the coverage percentage is shown. Missing data is never scored as poor performance. Overall business health is the net-sales-weighted average of eligible location scores.*

## **11.3 Normal-performance baseline**

**1\.** Use complete comparable weekdays for the same location; exclude known closed days and invalid/partial data.

**2\.** Target the prior eight comparable weekdays; permit a provisional baseline with at least four points.

**3\.** Use a simple robust center (median) and recent trend adjustment with documented bounds.

**4\.** Store the comparison dates, expected value, coverage and formula version.

**5\.** Evaluate a fixed alert only when both the deviation and the Admin-configured business threshold are met.

## **11.4 Forecasting boundary**

V1 provides a baseline weekly sales expectation using comparable weekdays and recent trend. It is not a demand-planning or inventory-replenishment engine. Forecast output includes the expected value, a simple range, history coverage and an “insufficient history” state.

## **11.5 AI release acceptance**

| Test area | Acceptance |
| :---- | :---- |
| **Grounding** | Test answers’ numeric claims match controlled tool results for the same scope/period. |
| **Insufficient data** | Missing margin/channel/history questions produce an explicit limitation, not an invented answer. |
| **Authorization** | Manager prompts cannot reveal another location or company-wide finance. |
| **Mutation safety** | Prompt injection cannot post replies, alter inventory or run unrestricted queries. |
| **Fallback** | Critical dashboards/brief remain available if AI narration fails. |
| **Historical/reporting range** | Representative longer-period questions (Q2 vs Q1, July summary, 90-day vendor spend) use controlled tools, authorized scope and available history. |
| **Evidence / impact** | AI answers expose supporting evidence where available and show financial impact only when it can be reliably calculated; estimates remain clearly labeled. |

# **12\. Invoice OCR, Food Cost and Inventory**

*![][image6]*

*Figure 6 — Invoice OCR human-review workflow*

## 

## **12.1 Invoice processing states**

| State | Meaning | Next |
| :---- | :---- | :---- |
| **RECEIVED** | File/email accepted and stored privately. | PROCESSING / REJECTED |
| **PROCESSING** | OCR/vision and validation in progress. | PENDING\_REVIEW / FAILED |
| **PENDING\_REVIEW** | Candidate fields require user confirmation/correction. | APPROVED / REJECTED / PROCESSING |
| **APPROVED** | Human-confirmed record may affect vendor/food-cost reporting. | Terminal; amendment is versioned |
| **REJECTED** | User/security rejection with reason. | Terminal; resubmission is new |
| **FAILED** | Technical failure with safe error. | Retry / reject |

## **12.2 Purchase-based food cost**

| FINANCIAL INTERPRETATIONV1 food cost is a purchase-based estimate: approved food/ingredient invoice spend divided by net sales for the same period and location. It is useful for trend and target comparison, but it is not actual COGS because inventory movement and recipe depletion are not fully automated. |
| :---- |

| Metric | Formula | Display rule |
| :---- | :---- | :---- |
| **Approved food purchases** | Sum of approved food/ingredient invoice amounts for location/period. | Exact approved purchases; shows invoice coverage. |
| **Purchase-based food-cost %** | Approved food purchases ÷ net sales. | Label “Estimated / purchase-based”; compare with 20%–22% configurable target. |
| **Estimated Profit at Selected Margin** | Net sales × configured selected margin (initially 15%). | Planning estimate only; the selected margin is shown and no live-P\&L claim is made. |
| **Ingredient/vendor price change** | (Current normalized unit price − prior price) ÷ prior price. | Approved invoice observations only; show unit and source. |
| **Menu-item apparent margin** | Only from a validated item-cost mapping. | Otherwise unavailable; no recipe cost is invented. |

## **12.3 Inventory days remaining**

Estimated days remaining \= current manually entered quantity ÷ approved average daily usage. Average usage may come from recent manual quantity history or a simple selected sales correlation for suitable items. The calculation never changes the stored on-hand quantity automatically and is unavailable when usage evidence is not credible.

# **13\. Security, Privacy and Non-Functional Requirements**

## **13.1 Security controls**

**•** TLS for all traffic; encryption at rest for MongoDB, object storage and backups.

**•** Adaptive password hashing, time-limited reset/activation tokens, session expiration and rate limiting.

**•** Least-privilege provider credentials and environment-specific secrets; secrets never returned to browser or logs.

**•** No payment-card PAN, CVV or magnetic-stripe data stored; retain only safe tender category/amount/reference where required.

**•** Short-lived, authorized object-storage URLs for invoice originals.

**•** Audit high-risk actions and retain correlation IDs across request, job, provider call and notification.

**•** AI evidence is minimized to the authorized question and no provider secret is sent to the model.

**• Client production data is confidential and is used only for approved project delivery, operation and support.**

**• Client data is not used to train models for other customers or other models outside the approved project use.**

**• Delivery-team access to production systems, data and credentials is removed at completion/handover unless the client explicitly authorizes continued support access.**

**• The client can request a full export of client-owned production data on demand in a documented portable format.**

## **13.2 Non-functional requirements**

| Area | V1 requirement |
| :---- | :---- |
| **Availability** | Production monitoring and alerting for the web/API, cron workers, MongoDB, object storage and email. Vercel/container-platform/Atlas/Resend health signals are used; planned maintenance is communicated. |
| **Performance** | Common dashboard views should load from published aggregates; target p95 under 3 seconds under agreed test load, excluding provider sync/OCR jobs. |
| **Scalability** | Configuration-driven locations; canonical provider-neutral data; no location-specific schema fork. |
| **Reliability** | Idempotent jobs, bounded retry, failed-job/manual retry path and last-good snapshot preservation using MongoDB job tracking rather than a separate queue/cache service. |
| **Data freshness** | Every module displays business date, last successful source time and COMPLETE/PARTIAL/STALE/UNAVAILABLE state. |
| **Accessibility** | Keyboard-accessible primary flows, semantic headings/labels and sufficient contrast for the delivered web design. |
| **Responsive UI** | Usable on desktop and tablet; Light Mode is included in V1; mobile web supports core reading and inventory/invoice actions where practical. |
| **Observability** | Vercel and managed-container logs/health checks, MongoDB Atlas monitoring/alerts, Resend delivery events, structured application logs and sensitive-data redaction. |
| **Backup/restore** | MongoDB Atlas Cloud Backup with point-in-time recovery on the selected production plan, object-storage versioning/retention, documented restore procedures and at least one staging restore verification before handover. |

## **13.3 Data retention baseline**

| Data | Baseline |
| :---- | :---- |
| **Canonical sales/aggregates** | Retained for business history unless client policy requires deletion. |
| **Raw provider payloads** | Retained only as needed for reconciliation/support; configurable and documented. |
| **Invoice originals** | Retained under client-approved policy; private and access-audited. |
| **Audit/security events** | Retained for the agreed support/compliance period; append-only from application paths. |
| **AI/chat traces** | Retain minimized prompts/tool references under client-approved policy; credentials and unnecessary sensitive content excluded. |
| **Full client data export** | Available on demand in a documented portable format; export remains subject to authorization and client retention policy. |
| **Original Toast historical export** | Retained unchanged in client-owned private object storage under the client-approved retention policy so it remains available for reconciliation/reprocessing. |

# **14\. Testing, UAT, Deployment and Handover**

## **14.1 Test strategy**

| Test type | Coverage |
| :---- | :---- |
| **Unit** | KPI formulas, estimates, score, baseline, forecast, fixed alert rules, parsing and validation. |
| **Integration** | Square/Google adapters, Toast historical-import and cross-POS canonical mapping path, MongoDB repositories/job tracking, object storage, OpenAI schemas and Resend events using test/sandbox accounts. |
| **Authorization** | Cross-role, cross-location, finance inference, exports, object URLs, notifications and AI tools. |
| **Data quality** | Backfill idempotency, reconciliation, duplicate invoices, Partial-to-complete Morning Brief revision, partial source and stale inventory/snapshot behavior. |
| **AI/OCR evaluation** | Grounding, insufficiency responses, OCR extraction accuracy ≥90% on client-provided real invoices, 100% human confirmation of high-risk fields, human-review enforcement and prompt-injection safety. |
| **End-to-end** | Login → dashboard → drill-down; invoice upload → approval; inventory update → warning; review draft → Admin post; 5:00 AM brief. |
| **Operational** | Backup restore, provider outage, failed brief fallback and manual re-run runbook. |

## **14.2 Critical UAT scenarios**

| ID | Scenario |
| :---- | :---- |
| **UAT-01** | Owner/Admin sees all three locations; Manager sees only assigned location(s). |
| **UAT-02** | Square historical backfill and three successful live production cycles reconcile within the tolerances defined in Section 9.3; Toast remains historical-export only.  |
| **UAT-03** | Command Center shows yesterday, daily location scores/rank, best/weakest and top priorities. |
| **UAT-04** | Finance shows formulas/labels for the food-cost estimate and Estimated Profit at Selected Margin using the configured 15% initial margin. |
| **UAT-05** | Client-approved Square mapping for dine-in, takeout, delivery, third-party and direct online orders is validated against representative data; any unreliable/unmapped channel remains Unknown. |
| **UAT-06** | Ask-the-AI answers representative must-have questions and states insufficiency for unsupported margin data. |
| **UAT-07** | Admin changes a fixed alert threshold and the next evaluation uses the new value without requiring code deployment. |
| **UAT-08** | Morning Brief is available by the 5:00 AM Pacific target in email and dashboard history under normal test conditions. |
| **UAT-09** | Invoice OCR cannot affect reports until a user approves it; duplicate candidate is handled. |
| **UAT-10** | Manager updates manual inventory; days remaining and low-stock warning update with history. |
| **UAT-11** | Google review reply cannot post without Owner/Admin confirmation. |
| **UAT-12** | Toast and Square provider records map into the same canonical records where approved; the original Toast export remains unchanged in client-owned storage and the import uses all reasonably available history. |
| **UAT-13** | Relevant analytical screens expose Yesterday, 7 Days, 30 Days, WTD, MTD, YTD, prior-year comparison and Custom Range, with unavailable history labeled. |
| **UAT-14** | A 5:00 AM Partial Morning Brief automatically receives a newer current revision after delayed data arrives/reconciles, while the earlier revision remains in history. |
| **UAT-15** | Ask-the-AI answers the agreed longer-period examples and provides supporting evidence and reliable financial impact where available without inventing missing data. |
| **UAT-16** | Invoice category reporting, reusable approved OCR/item/unit corrections and Vendor Intelligence drill-down work on approved invoices. |
| **UAT-17** | Owner/Admin changes the configured score component weights and subsequent score calculation uses them. |
| **UAT-18** | Inventory stale-count indication is visible and the count/update workflow remains usable on supported mobile web layouts. |
| **UAT-19** | Light Mode is available and Reporting Center appears as the specified top-level Owner/Admin navigation item. |

## **14.3 UAT exit and acceptance**

**•** All critical requirements pass or have a written, approved deviation.

**•** No unresolved critical/security defect remains.

**• Data definitions, targets and the final Square channel mappings for dine-in, takeout, delivery, third-party and direct online orders are approved by the client.**

**• Production accounts, domains, recipients, locations and schedules are confirmed; the final hosting/database/storage/backup stack, expected monthly cost and available usage/billing alerts are reviewed before production, with production accounts under client ownership.**

**•** Runbooks, training material and handover package are complete.

**• Each milestone is accepted when its in-scope deliverables have been demonstrated live, relevant testing is completed, source is committed to the client-owned GitHub repository and required documentation is delivered.**

**•** Client signs the approval statement in Appendix E or provides equivalent written approval.

The client will have 3–5 business days to review and test each milestone after delivery of the applicable build, demonstration and supporting materials.

• Final production acceptance requires three successful live production cycles meeting the approved acceptance criteria, with no unresolved critical or security defect.

## **14.4 Handover package**

**• Client-owned GitHub repositories from day 1 with complete committed source history.**

**•** Environment/configuration guide and sample environment-variable template without secrets.

**•** Architecture, MongoDB collections/indexes, API contracts and provider mapping documentation.

**• Full client ownership/IP rights in the delivered code, database/data model, Figma design files, prompts, architecture and rights to use, modify, deploy and operate the delivered SaaS.**

**• Test results and final UAT/acceptance record.**

**•** Deployment/rollback, backup/restore and operational runbooks.

**• Credential/account ownership checklist; recorded Owner walkthrough; recorded Manager walkthrough; Admin/Manager quick-start user guides; recordings delivered at handover.**

**• Thirty-day bug-fix support begins after production acceptance and is limited to defects against the approved specification. Response targets: Critical ≤4 hours; Major ≤1 business day; Minor ≤3 business days.**

**• A list of material third-party libraries/services used in the delivered solution, including their applicable licensing terms.** 

# **15\. Delivery Plan, Change Control, Risks and Decisions**

## **15.1 Delivery sequence**

| Milestone | Target sequence | Core deliverables |
| :---- | :---- | :---- |
| **1\. Planning & architecture** | Week 1 | Approved specification, diagrams, MongoDB schema, POS abstraction design, wireframes including client review/approval of the Reporting Center wireframe, client-owned GitHub repository and development environment; confirm Square OAuth/sandbox access, channel-mapping plan and Toast export/archive plan. |
| **2\. Core platform & Square integration** | Weeks 2–3 | Auth/RBAC, users/locations, Square live ingestion/backfill, Toast historical import/archive, cross-POS canonical mappings, MongoDB, Command Center, Store Performance, core Finance, daily score/rank, Morning Brief revision behavior and settings. |
| **3\. Intelligence & Reporting Center** | Week 4 | Six-tool Ask-the-AI with longer-period/reporting questions and evidence, baselines, configurable score weights, alerts, forecast, Reviews, SEO/direct orders, Executive Reporting Center, scorecards and AI summaries/recommendations. |
| **4\. Advanced business intelligence** | Week 5 | Invoice OCR, spend categories, reusable approved corrections, vendor drill-down/price history, purchase-based food cost, manual ingredient inventory, stale/mobile inventory behavior, CSV/bulk enhancements and report outputs. |
| **5\. Testing, deployment & handover** | Week 6 | System/UAT fixes, final production stack/cost/billing-alert review, production deployment, documentation, source/IP handover, recorded training and start of post-production-acceptance support. |

*The client-facing delivery sequence spans six weeks. Exact calendar dates remain governed by the agreed Upwork milestones and may be adjusted for provider access or dependency timing without expanding approved scope. Milestone acceptance requires a live demo, completion of relevant testing, source committed to the client-owned GitHub repository and required documentation delivered.*

## **15.2 Change-control rule**

| NO IMPLIED SCOPE  After approval, a request is a scope change when it adds a new live integration/provider beyond the approved Square/Google sources, a new workflow or screen beyond the approved Reporting Center and modules, a new external write, a new alert type, a materially different calculation, broader automation, an additional user role, a native application or a different acceptance condition. The team will document impact on effort, cost and schedule before implementation. |
| :---- |

## **15.3 Risk register**

| Risk | Impact | Mitigation / decision |
| :---- | :---- | :---- |
| **Square OAuth/sandbox access or required scopes are delayed/unavailable.** | Live POS integration, testing or dependent KPI coverage is delayed/partial. | Confirm Square OAuth, sandbox access, locations and required scopes before dependent work; show unavailable/partial capability rather than inventing data. |
| **Toast is decommissioned before the historical export is obtained.** | Historical backfill and comparable baseline coverage may be permanently reduced. | Obtain the client-provided Toast export before decommissioning, preserve the original unchanged in client-owned storage and import all reasonably available history; target 12+ months and more where available. |
| **5:00 AM target conflicts with provider latency.** | Delayed/partial brief. | Start pipeline earlier; tune schedule in staging; publish Partial transparently and automatically publish a newer revision after missing data arrives/reconciles while retaining the earlier revision. |
| **Direct-order source cannot be reliably separated.** | Direct order metric unavailable. | Use explicit mapping only; unknown remains unknown. |
| **Insufficient comparable history.** | Provisional score/forecast/alerts. | Backfill available history; require minimum comparable points and show coverage. |
| **Invoices use inconsistent units/vendor names.** | Poor price comparison. | Human review, vendor aliasing and unit normalization; withhold unreliable comparisons. |
| **Manual inventory is not updated consistently.** | Stale days-remaining/warnings. | Show last updated/by, freshness warning and manager responsibility. |
| **Food-cost / Estimated Profit at Selected Margin figures are mistaken for accounting results.** | Business misinterpretation. | Prominent estimate labels, selected-margin disclosure, documented formulas and no actual P\&L claim. |
| **Google API access/history limitations.** | Partial SEO/review data. | Capability/date-aware reporting and explicit setup dependency. |

## **15.4 Decision register**

| Decision | V1 resolution |
| :---- | :---- |
| **Database** | MongoDB Atlas is the system of record. |
| **Authentication** | Email/password only; no Google sign-in in V1. |
| **POS** | Square live; POS-neutral canonical model retained; Toast historical export preserved unchanged in client-owned storage; approved Toast/Square aliases map to common canonical records where appropriate; final Square channel mappings are client-approved before go-live. |
| **Inventory** | Manual ingredient inventory, approximately 30–50 core items per location; no POS menu stock or automated depletion/PO/transfer. |
| **Brief schedule** | Target 5:00 AM Pacific; pipeline begins earlier and timing is tuned during staging; a Partial brief is automatically revised when delayed data later arrives and reconciles, with prior revision retained. |
| **Location score** | Deterministic daily score and ranking with visible inputs/coverage; Section 11.2 component weights are Owner/Admin configurable. |
| **AI tooling** | Six controlled, read-only tool families; authorized longer-period/reporting analysis, evidence drill-through where available and explicit insufficient-data responses. |
| **Alerts** | Fixed catalogue with Admin-configurable thresholds; owner/assignee, notes, lifecycle and supporting evidence; no arbitrary rule builder. |
| **Reviews** | Google Business Profile only as the V1 live review provider; provider-neutral SEO/review contracts allow future sources such as Yelp without rebuilding core reporting. |
| **Food cost** | Purchase-based estimate versus 20%–22% configurable target; not actual COGS. |
| **Estimated Profit at Selected Margin** | Net sales × configurable selected margin, initially 15%; not live accounting P\&L. |
| **Reporting Center** | Owner/Admin top-level navigation item immediately after Morning Brief; client approves its wireframe before implementation; reporting covers the agreed business areas where data is available. |
| **UI theme** | Light Mode is included in V1. |
| **Production ownership/cost** | Before production, final hosting/database/storage/backup stack, expected monthly cost and available usage/billing alerts are confirmed; production accounts remain under client ownership. |

## **15.5 Pre-build closure checklist**

| Area | Required closure |
| :---- | :---- |
| **Square** | Confirm Square OAuth, location mapping, required scopes and sandbox/test access; approve the final dine-in, takeout, delivery, third-party and direct-online channel mapping before go-live. |
| **Toast historical export** | Obtain the client-provided Toast historical export before decommissioning; preserve the original unchanged in client-owned private storage and import all reasonably available history, targeting 12+ months and more where available. |
| **Google** | Confirm GA4 properties/events, Search Console sites, GBP accounts/locations and review API access. |
| **Business rules** | Approve gross/net sales definitions, direct-order definition, 20%–22% targets by location, 15% margin target, score component weights and alert thresholds. |
| **Schedule** | Confirm location timezones, 4:00 AM local business-day cutoff, America/Los\_Angeles brief timezone, recipients and automatic revision behavior for a 5:00 AM Partial brief. |
| **Invoices** | Confirm upload/email intake method, size limits, sample invoices, vendor aliases, spend-category mapping and representative correction mappings. |
| **Inventory** | Provide initial core items, units, par levels, current quantities, costs, vendors and update responsibility. |
| **Deployment** | Confirm the final managed API/worker platform, object-storage vendor/accounts, MongoDB Atlas production backup/PITR plan, monitoring/health checks, expected monthly cost and available usage/billing alerts; production accounts remain client-owned. |
| **Reporting Center** | Review and approve the Reporting Center wireframe before implementation begins; confirm its top-level Owner/Admin navigation placement after Morning Brief. |
| **UI** | Confirm the delivered V1 Light Mode during design/UAT review. |

# 

# **Appendix A — KPI and Formula Dictionary**

| Metric | V1 definition |
| :---- | :---- |
| **Gross sales** | Provider-defined item/check sales before discounts/refunds; displayed with source definition. |
| **Net sales** | Canonical sales after approved discounts/refunds, excluding tax/tip according to the approved Square mapping. |
| **Average ticket** | Net sales ÷ completed order/check count. |
| **Direct online orders** | Orders whose Square order source/fulfillment fields are explicitly mapped in the client-approved pre-go-live channel mapping; unreliable/unmapped channels remain Unknown. |
| **Purchase-based food-cost %** | Approved food/ingredient invoice spend ÷ net sales for matching location/period; estimate, not COGS. |
| **Estimated Profit at Selected Margin** | Net sales × configured selected-margin target; initial margin 15%. |
| **Location score** | Weighted 0–100 score using eligible sales, demand-quality, exception-control and operating components; Section 11.2 weights are Owner/Admin configurable. |
| **Business health score** | Net-sales-weighted average of eligible location scores; coverage displayed. |
| **Normal performance** | Expected value from complete comparable weekdays for the same location, adjusted by bounded recent trend. |
| **Estimated days remaining** | Current manual quantity ÷ approved average daily usage; unavailable when usage is zero/unknown. |
| **Price increase %** | (Current normalized unit price − comparison price) ÷ comparison price. |

# **Appendix B — Data Availability and Confidence States**

| State | Meaning | Display behavior |
| :---- | :---- | :---- |
| **COMPLETE / EXACT** | Required data is available and reconciled for the period. | Show value, source and freshness. |
| **ESTIMATED** | Formula uses an approved assumption or proxy. | Prominent estimate label plus formula/assumption. |
| **PARTIAL** | Some source data or coverage is missing. | Show available value with coverage and warning; suppress misleading alert. |
| **STALE** | Last successful source update is older than the allowed threshold. | Show last successful time and warning. |
| **PROVISIONAL** | Insufficient history for normal confidence. | Show insight/forecast with low-confidence label; no normal alert by default. |
| **UNAVAILABLE** | Provider entitlement, mapping or required data does not exist. | Show unavailable and reason; never show zero. |

# **Appendix C — Requirement Traceability Summary**

| Source | Specification coverage | Resolution |
| :---- | :---- | :---- |
| **Client Q1 — Documentation** | Document Control; Sections 1–15; Appendices | One consolidated blueprint, scope, architecture, acceptance, security, handover and change control. |
| **Client Q2 — Finance** | 6.6, 12.2, Appendix A | Daily/weekly/MTD, comparisons, targets, 20%–22% food cost, Estimated Profit at Selected Margin and clear assumptions. |
| **Client Q3 — Store Performance** | 6.4–6.5, 6.11 | Requested metrics, channels, categories, AI summary, issue/opportunity, daily location score/ranking. |
| **Client Q4 — SEO/direct orders** | 6.7, 8.3 | GSC/GA4/GBP, direct-order volume/revenue, automatic/manual setup and Square live POS mapping. |
| **Client Q5 — Ask-the-AI** | 6.12, 11 | Six controlled tool families cover listed questions; explicit insufficiency. |
| **Client Q6 — Alerts/brief** | 6.13–6.14, 9.1 | 5:00 AM Pacific email \+ dashboard \+ history; fixed configurable thresholds and specified alert types. |
| **Client Q7 — Inventory** | 6.10, 12.3 | Manual ingredient inventory, 30–50 core items/location, history, CSV import/export, bulk updates, copy-previous count, mobile entry, search/filtering and bounded exclusions. |
| **PM review** | Document Control; Sections 3, 6.10–6.16, 8–9 | Executive summary, Square live POS, Toast historical export, Reporting Center, inventory additions, timing/reconciliation, score/rank, six AI tools and configurable alerts. |
| **Client V1.1 final clarifications — POS/data/brief** | 3.3–3.4; 5.1–5.2; 6.3–6.4; 6.14; 8–10; 14–15 | Cross-POS canonical continuity; original client-owned Toast archive; all reasonably available Toast history; automatic Partial-brief revision; standard date controls; client-approved Square channel mappings. |
| **Client V1.1 final clarifications — Reporting/AI/vendor/invoices** | 5.3–5.4; 6.9, 6.12, 6.15; 11; 14–15 | Reporting Center wireframe approval and agreed reporting domains; vendor drill-down; spend categories; reusable approved corrections; longer-period AI; evidence drill-through and reliable financial impact. |
| **Client V1.1 final clarifications — Score/workflow/future readiness** | 6.7, 6.10–6.14; 7; 13–15; Appendix F | Configurable score weights; alert assignment/notes; future Morning Brief priority action-state architecture; provider-neutral future SEO/review adapters; stale/mobile inventory; finance labels preserved; production stack/cost/billing review; Light Mode and Reporting Center navigation. |

# **Appendix D — Diagram Placement Guide**

The Mermaid source pack delivered with this document contains first-class code for the following figures. Export each diagram as PNG with a transparent or white background and replace the corresponding placeholder in the DOCX.

| Figure | Mermaid source block | Recommended placement |
| :---- | :---- | :---- |
| **1** | Daily Data-to-Decision Flow | Section 5 |
| **2** | Logical System Architecture | Section 7 |
| **3** | POS Abstraction and Ingestion | Section 8 |
| **4** | MongoDB Logical Data Model | Section 10 |
| **5** | Controlled AI Flow | Section 11 |
| **6** | Invoice OCR Human Review | Section 12 |
| **7** | Alerts and Morning Brief Workflow | Section 6.13/6.14 or after Section 9 |

*![][image7]*

*Figure 7 — Alerts and Morning Brief workflow*

# **Appendix E — Approval Statement**

By approving this specification, the parties confirm that it is the Version 1 business, functional and technical blueprint and agreed scope baseline. Capabilities explicitly marked unavailable, conditional or out of scope are not acceptance defects. Any material change will follow Section 15.2.

| Party | Name / title | Signature | Date |
| :---- | :---- | :---- | :---- |
| **Gourmet Palace / Client** |  |  |  |
| **Delivery team / Contractor** |  |  |  |

# **Appendix F — MongoDB Rationale and Monthly Cost Breakdown**

MongoDB Atlas remains the V1 system of record because the platform combines provider-normalized POS facts, configuration, workflow/audit documents, published aggregates and reporting data in a configuration-driven model. It keeps the approved architecture to one operational database while providing managed security, monitoring and backup/restore capabilities required by this specification.

MongoDB was chosen because the data is document-shaped (variable invoice lines, orders, AI traces), Atlas provides native vector search for the AI and managed backup/PITR, and one operational database keeps the model configuration-driven. Supabase/PostgreSQL offers stronger SQL analytics and built-in auth but needs more custom workflow code and a separate vector extension. As a planning estimate at current public pricing, the lean V1 stack (Vercel Pro, low-tier Atlas or Supabase Pro, Resend/Cloudflare free tiers, usage-based OpenAI) **lands roughly in the $40–60/month range**; final figures are confirmed in the deployment checklist before provisioning.

Monthly provider costs depend on the client-selected plan, usage and current provider pricing. Approved price figures were not supplied in the scope-change document, so this specification records the recurring cost components without inventing rates. Before production provisioning, the final selected stack/tier, expected monthly amount and available provider usage/billing alerts are confirmed and recorded in the deployment checklist. Production provider accounts remain under client ownership.

| Service / solution | Purpose | Monthly cost basis |
| :---- | :---- | :---- |
| **Vercel** | Next.js web application and web monitoring/logs. | Client-selected plan at current provider rate. |
| **Managed container platform** | Node.js/Express API and cron/background workers. | Client-selected compute plan and usage. |
| **MongoDB Atlas** | System of record, monitoring/alerts, Cloud Backup and point-in-time recovery. | Selected production tier plus backup/storage usage at current provider rate. |
| **S3-compatible object storage** | Private invoice originals, derived assets and unchanged Toast historical export archive; versioning/retention. | Storage, request and egress usage. |
| **Resend** | Morning Brief, alert and account email delivery/events. | Selected plan and email volume. |
| **Cloudflare** | DNS, TLS/CDN and edge protections. | Selected plan at current provider rate. |
| **OpenAI** | Controlled AI, summaries and OCR/vision assistance. | Usage-based client billing; variable with model/token/image usage. |
| **Monitoring / operations** | Vercel, container-platform, MongoDB Atlas and Resend native health/telemetry. | Included in selected provider tiers unless an additional paid monitoring service is approved. |

# **Appendix G — Multi-Tenant & SaaS Foundational Principles**

The V1 architecture preserves the following foundational principles to support future multi-tenant/SaaS evolution without changing the approved V1 functional scope:

• Organization and location scoping: Every business record is scoped by organization and, where relevant, location. Existing organizationId and locationId boundaries remain the basis for access control and data separation.

• Strict tenant isolation: Data access through the UI, API, background jobs, exports, notifications and AI/tool calls must remain restricted to the authorized organization and location scope. One organization must not be able to access another organization’s data.

• Configuration-driven behavior: Tenant/location-specific targets, thresholds, mappings, schedules, notification settings and provider connections are configuration-driven rather than embedded directly in application code.

• Zero hardcoded tenant/business-specific rules: Tenant-specific business values, identifiers, mappings and operating rules must come from configuration rather than hardcoded application logic. System-wide V1 formulas and the fixed alert catalogue remain governed by the approved specification and versioned application logic.

• Shared canonical contracts: Core data models and provider-neutral contracts remain reusable across organizations and locations without a tenant-specific schema fork.

• Provider and credential isolation: External-provider mappings and credentials remain scoped to the applicable organization/environment and are not exposed across tenants.

These principles document the architectural foundation only and do not expand V1 into a full multi-tenant SaaS product.

**END OF SPECIFICATION — VERSION 1.2**
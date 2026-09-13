# Retail parity implementation and acceptance plan

Audit date: 2026-09-13. Reference: https://dhandopos.in/ and its retail feature guides. Public vendor claims do not establish independent device testing. Restaurant tables, KOT and waiters are excluded.

## Current verdict

Not feature-for-feature equivalent. Core billing, clothing variants, purchasing, dues, stock counts, receipts, recurring schedules and multiple isolated shops exist. Earlier 9/10 and completion claims overstated what was integrated and verified.

## Delivery order

| Priority | Work | Completion gate |
| --- | --- | --- |
| P0 | Close cashier bypasses in legacy inventory, deletion, scheduling and supplier payments | Direct RPC attempts fail; manager actions and cashier sales continue to pass |
| P0 | Complete HttpOnly sessions | No bearer token in JSON, localStorage or IndexedDB; allowlisted server RPC proxy, CSRF/origin checks, server logout, renewal and offline recovery tests |
| P1 | Advance recurring skip dates and route delivery lists | Skip posts no sale/stock/debt; retry advances once; route/date exports show only scheduled active deliveries; cross-shop access rejected |
| P1 | Server pagination wired into screens | Search and barcode work beyond page one, stable cursors, no full history bootstrap, offline catalogue policy; statements/exports retain all records |
| P1 | Accurate summary reporting | Refunds, net-of-tax profit, expenses, legacy sales and dues reconcile; client uses scoped read model with visible freshness |
| P1 | Split tender, held bills and quotations/orders | Cash/UPI/card components reconcile; held carts restore; quote→order→invoice converts once with current stock validation |
| P1 | Contacts and credit control | Edit contacts, payment terms, credit limits, aging and user-triggered WhatsApp reminders; atomic credit checks |
| P1 | Product lots and partial returns | FEFO stock, separate lot expiry, partial refund/tax/stock allocation and idempotent return against original invoice |
| P2 | Accounting and GST preparation | Balanced journals, opening balances, bank/cash accounts, trial balance, balance sheet, cash flow; GSTR workpapers reconcile to invoices and credit notes against current official rules |
| P2 | Thermal and label adapters | Browser fallback plus supported USB/serial/BLE profiles, connection failure handling, 58/80 mm receipt and label-size acceptance on supplied hardware |
| P2 | Reviewed purchase extraction | Multi-image matching with variants, duplicate merge, confidence/review fields; printed and handwritten fixture acceptance; provider configuration if cloud AI is used |
| P2 | Offline completion | Durable invoice identity, offline receipt, stock reservation/conflict UX, contact/catalogue sync and real mobile browser eviction/reconnect tests |
| P2 | Appearance and accessibility | Shop logo, sound/font settings, complete supported-language labels, keyboard flows and mobile/dark-mode screenshots |
| P0/P2 | Operations and quotas | Checksummed versioned migrations; atomic quota/rate limits; sanitized monitoring and alert routing; encrypted backup plus restore drill into an explicitly separate database |

## Audit findings to track

- Initial audit found UI-only pagination. Bills and movements now use scoped server pages; product/contact lists still need server pagination.
- The original summary materialization is not used. A new transactional daily projection now powers report totals and reconciles returns, tax, legacy sales and expenses. The old materialization is deprecated.
- Initial audit found a cookie endpoint that still returned bearer tokens to the browser. This change replaces that transport; renewal and broader browser/offline acceptance remain pending.
- OCR already used Tesseract's worker; an additional wrapper worker needs runtime browser validation and cancellation handling.
- Recurring execution already runs in pg_cron. Improve scheduling isolation, fairness and observability rather than describing it as a new browser-to-worker migration.
- Backup scripts have not completed a restore drill. They currently pass credentials in process arguments and need hardening before operational use.

## Release rules

Each capability must have UI integration, server validation, shop isolation and workflow tests before it is marked complete. Builds and the existing 43 tests alone do not prove a new feature works. Preserve recorded shop data, bill history, credentials and unsynced sales. Record remaining gaps rather than increasing a numeric score without evidence.

## September 13 implementation status

Implemented in this change:

- Quotations and sales orders: save the Sell cart, confirm an order, cancel it, or convert it to one invoice. Customer/product snapshots are retained. Conversion checks current stock and uses transactional idempotency. Quote lists load 50 records at a time; CSV download is available.
- Recurring routes and advance skip dates: manager settings, date/route filtering and delivery CSV. Skips advance the billing schedule without generating sales, stock movements or customer debt. Lists show upcoming unbilled occurrences, not a completed-delivery manifest.
- HttpOnly session transport: the browser uses an opaque cache ID, an allowlisted server RPC proxy and same-origin checks. Logout revokes the database session. Legacy offline bearer cache keys are removed while pending sale records are preserved. Sessions require reauthentication after the 12-hour cookie expires; sliding renewal is not implemented.
- Manager checks on legacy product creation/editing/counting, password-confirmed deletion, recurring scheduling and supplier payments. Cashier checkout remains allowed. Cashier read redaction was subsequently implemented; see the competitive release gates below.
- Shared migration manifest for setup, migration and new workflow fixtures. Direct access to the report materialization is revoked.

Verification: 45 automated tests passed; lint passed without warnings; Next.js and Vite production builds passed. Isolated HTTP checks passed for token-free login/session responses, HttpOnly cookies, origin rejection, operation allowlisting, tab/account binding and logout revocation. The Supabase migration was applied; live multi-shop and checkout smoke checks passed with all verification rows rolled back. Hardware/mobile/offline acceptance and backup restoration remain unverified.

Next implementation order remains: resilient session renewal; real paginated workspace reads and report reconciliation; split tender/held bills; contact credit controls and partial returns/lots; accounting/GST; device/OCR/offline acceptance and operational drills. This release is not full Dhando retail parity.


## Competitive replacement release gates

Dhando's public website describes product capabilities, not an independently verified internal architecture, security audit or load benchmark. Matching its retail workflow is a product objective; matching its speed and capacity must be established through our own measurements.

| Dimension | Proposed acceptance target | Current evidence / remaining work |
| --- | --- | --- |
| Counter speed | p95 product search under 300 ms; p95 checkout under 1 second on a defined India-region deployment | Timestamp-range queries and composite indexes added. No hosted latency benchmark yet. |
| Capacity | 100 simultaneously active shops, 10,000 products/shop and 100,000 historical invoices/shop in staging | Transactional quotas and shared request limiter implemented; dataset/load test and capacity sizing pending. |
| Isolation | No cross-shop reads/writes or cashier cost/supplier access through supported RPCs | Automated cross-shop, nested cost redaction, supplier filtering and retry tests pass. Independent security review pending. |
| Reliability | Zero duplicated bills in reconnect/retry tests; zero negative stock under concurrent checkout | Existing transactional/idempotency tests pass; multi-client concurrent load and real mobile reconnect trials pending. |
| Recovery | Proposed RPO 15 minutes, RTO 60 minutes | Targets only: backup scheduling/PITR configuration, encrypted retention and isolated timed restore drill pending. |
| Operations | Actionable alerts for repeated checkout errors, failed scheduled jobs and stale backups | Alert destination, monitored deployment and escalation ownership need configuration and verification. |
| Retail completeness | Every P1/P2 workflow above passes UI, database, mobile and device acceptance | Quotations/orders and scheduled delivery skips added; remaining feature gaps are explicitly open. |

Additional hardening implemented after the first validation pass: cashier workspace responses omit supplier and management records and recursively remove buying costs from invoices and retry responses; legacy dashboard costs are redacted and management pagination is blocked for cashiers. Database-backed request limits allow 600 proxy operations per shop per minute (shared across server instances), returning HTTP 429 with Retry-After. This is a protective default, not a capacity benchmark; direct database administrative access is outside this HTTP budget. Product/invoice quota triggers acquire the shop transaction lock before checking counts. HTTP request bodies are capped while streaming. History filters use half-open IST timestamp bounds and composite indexes, and page ordering includes unique IDs. Full bootstrap pagination and reporting read-model integration remain unfinished.

## Second implementation pass

Implemented and verified:

- Daily report projection updated transactionally with invoices, full returns, legacy sales and expenses. Profit excludes tax. Rollback and migration rebuild tests reconcile to source records. The UI consumes the authenticated report RPC and labels its timestamp. Customer/supplier balances remain live ledger calculations with supporting indexes.
- Scoped workspace loading: Sell no longer fetches unrelated transaction histories. Bills and stock movements load 50 rows per server page. Customer statements and report exports retain their full selected-range records. Product/contacts remain a complete catalogue for current search, selectors and offline operation; their server pagination is still open. Offset pagination has stable ID tie-breakers but is not a snapshot cursor under concurrent inserts.
- Manager contact editing with credit limits and payment terms. New invoices snapshot their due date. The database blocks additional credit above the limit while permitting fully paid sales; failed invoices roll back stock changes. Existing invoice/customer snapshots stay unchanged. Aging reports and reminder flows remain open.
- Successful authenticated RPC calls renew the HttpOnly cookie idle window for up to 12 hours, capped by the original database expiry. This does not revive expired/revoked sessions or extend the database hard lifetime. Cookie transport tests cover renewal and revocation.
- Offline workspace caches distinguish views and validate date/page identity, preventing a cached history page from being represented as another range/page. Only the last visited page per view is cached; uncached history requires connectivity.

Validation: all 45 automated tests pass, including new source/projection reconciliation, 60-record pagination coverage, cross-shop and cashier restrictions, credit-limit enforcement, retries, rollback and migration rebuild assertions. Lint, typecheck, production builds and HTTP checks pass. Browser checks verified owner sign-in, contact policy save and report freshness display. Live Supabase checks verified report totals, scoped history, credit rejection and existing multi-shop flows; test records were rolled back.

Still open: product/contact server pagination, dedicated lazy report screens and streamed large exports; split tender and held bills; aging/reminders; partial returns and product lots; accounting/GST preparation; printer adapters/device acceptance; OCR/offline mobile acceptance; appearance completeness; checksummed migrations, backup hardening/restore drills, monitoring and measured hosted load tests. This pass does not mark the overall plan or competitive replacement readiness complete.

# Retail POS comparison and implementation specification

Scope: retail shops first, as selected by the user. Restaurant tables, waiter allocation, and kitchen tickets are deferred.

## Evidence and limits

Reference: [Dhando POS website](https://dhandopos.in/) and [public showcase](https://app.dhandopos.in/#/demo/showcase), reviewed September 2026. Its showcase exposed a fictional overview with recent bills and product chips, not a complete checkout workflow. Advertised capabilities below are vendor claims; offline reliability, printer compatibility, and accounting accuracy were not independently tested.

Our assessment uses the actual InventoryWorkspace, domain types, schema, RPC functions, and existing tests. Older PRD descriptions are not reliable implementation evidence: they still mention seeded inventory and missing features that have since changed. This specification supersedes the old V1 non-goals for future retail POS work; it does not imply those features are implemented.

## Baseline feature comparison (before implementation)

| Capability | Dhando advertises | Our implementation | Needed |
|---|---|---|---|
| Selling | Cart checkout | One item per sale | Atomic multi-item invoices |
| Tax | GST, HSN, tax splits | No tax fields | Configured tax treatment and invoice snapshots |
| Payments | Cash/card/UPI/credit | No payment records | Payment method, amounts, change and settlement |
| Customers | Udhaar ledger | No customer entity | Customer balances, payments, statements |
| Inventory | Barcode, expiry, counts | Products, categories, whole-unit counts, alerts | Units, barcodes, batches/expiry, stock movement history |
| Purchases | Supplier bills and AI import | Manual absolute stock updates | Suppliers, received stock, dues, reviewed imports |
| Reports | GST, P&L, cash register | Daily revenue, gross margin, CSV | Date ranges, expenses, tender totals, reconciliation |
| Printing | Thermal receipts and labels | CSV export | Receipt layouts and tested printer adapters |
| Offline | Queued billing and sync | Online RPC operations | Local outbox, safe retries and reconciliation |
| Sharing | WhatsApp invoice | None | User-initiated receipt sharing |
| Multiple shops | Separate branches | Already supported | Faster switcher and staff permissions |
| Appearance | Themes and font controls | English/Marathi, responsive UI | Font scale, theme, store and receipt preferences |
| Recurring | Scheduled bills | None | Templates, scheduler, skip rules and duplicate prevention |

## Usability changes to implement

The operational app should open on **Sell** for a cashier and **Overview** for an owner. Preserve the new landing page as the public introduction.

- Desktop: left navigation, searchable product catalog in the center, persistent cart on the right.
- Mobile: Home / Sell / Products / More navigation, with Customers, Purchases, Reports and Settings under More. Keep the cart total and Checkout reachable with one thumb.
- Product cards: name, selling price, available quantity and clear add action. Move cost and margin into owner views; do not crowd the cashier's product card with the current ten inventory-table columns.
- Selling flow: choose products → review cart → select payment → save bill → print/share or start the next sale. Default the catalog price and quantity of one; retain edits and drafts on errors.
- Use visible labels with icons, 44px or larger touch targets, numeric keyboards, Marathi/English labels, useful empty states and a clear connection indicator.
- Keep decorative animation on the landing page. Checkout motion should only communicate cart updates, progress and success, respecting reduced-motion preferences.

## Delivery order and completion gates

### 1. Counter foundation

Create invoices, invoice lines and payments with immutable product/price snapshots, decimal-safe amounts, unique invoice numbering and one idempotent transaction. Preserve existing sales as legacy records without inventing customer, tax or tender history. Add the Sell screen and responsive navigation. Retain all current inventory, shop scoping and closing functions.

Completion: a three-item cart saves once, a retry cannot duplicate it, insufficient stock rolls back the entire transaction, another shop cannot access it, and the persisted bill reopens with matching totals. A recorded UPI method must not be presented as bank-verified payment.

### 2. Retail records

Add customer credit/payment ledgers, supplier purchases and dues, cash opening/closing, expenses, returns, and historical reports. Extend quantities for weighted products. Returns are an additional retail requirement, not a capability verified in the inspected reference.

Completion: partial settlements and refunds reconcile; receiving stock creates a movement rather than overwriting physical counts; original invoices remain auditable; report totals match transaction records. Label gross profit separately from net profit after expenses.

### 3. Tax and output

Implement GST configuration and invoice formats against current official requirements, including registration details, tax-inclusive/exclusive pricing, rounding, discount treatment and relevant tax splits. Add receipts, barcode scanning/labels, spreadsheet imports and user-triggered sharing. Start with browser print, then validate required thermal hardware and browser/OS combinations.

Completion: tax examples verified, invoice totals reconcile, imported rows receive validation and preview, supported scanners/printers tested on real devices. Do not claim universal Bluetooth support.

### 4. Offline and advanced workflows

Implement a versioned installable app shell, shop-isolated local data, persistent outbox and server reconciliation. Design operation IDs and invoice identity during phase 1 so offline support does not require a rewrite. Add optional AI purchase extraction with review before posting and recurring templates with idempotent scheduling.

Completion: reload offline retains a draft; reconnect submits each bill once; cross-device stock conflicts are surfaced; switching shops cannot expose another shop's cached records; extraction errors never silently update stock.

## Product messaging

Update the landing page's feature claims only when the corresponding workflow is functional. Replace illustrative previews with a separate, clearly labeled demo using the real components once those components exist. Keep demo data and writes isolated from real shops. Do not reproduce Dhando's brand, screenshots, pricing or unverified speed claims.

## Status

The retail migration was applied to Supabase and the RPC endpoint became available on September 11, 2026. The SQL tests cover multi-shop authorization, atomic invoices, stock/purchase movements, customer/supplier balances, returns, cash reconciliation, GST snapshots, and manually generated recurring bills. Browser checks used an isolated SQL-backed fixture: super-admin shop creation, weighted checkout, receipt totals, and stock changes were verified.

September 12 voice follow-up: reusable voice inputs now cover editable text/numeric/date fields, search, super-admin shop forms, legacy inventory forms, and OCR review text. Passwords, file inputs, checkboxes, and selectors retain their native controls. Dictation uses the selected app language (English/Marathi), permits one active microphone, stops on unmount, preserves selected text, validates field limits, and surfaces errors. Browser providers may process speech online; this is not guaranteed local transcription. Ambiguous amounts require manual correction and dates require YYYY-MM-DD. Transcription is never an instruction to save a form or post a bill.

Validation: 37 automated tests pass; production build and lint pass. Desktop and narrow-screen product forms were inspected. Actual speech accuracy/permissions need testing with the user's microphone and supported browser. Camera scanning, OCR accuracy, physical receipt/label printers, and complete production offline reload/reconciliation still need device-level acceptance. Offline bills require manual sync; recurring templates require manual generation. Full background scheduling, appearance preferences, complete Marathi translation, batch-level expiry tracking, and granular staff roles remain pending. Restaurant workflows remain excluded. GST filing and e-invoice submission are not implemented.


### September 12 production hardening

Automatic reconnect sync, full checkout draft details, pending-request recovery after reauthentication, server-unreachable cache fallback, cash change calculation, device theme/accent/text preferences, and optional browser print dialogs are implemented. Automatic recurring billing is now available as an explicit per-template choice; the five-minute Supabase scheduler is active. Login throttling and verified database TLS are in place. The live legacy shop-creation function was updated to stop adding demo products; existing records were preserved. A transaction-based live smoke test confirms independent shop logins, retry-safe checkout, stock and credit reconciliation, and denied cross-shop access, then removes its verification data by rollback.

The preceding manual-sync/manual-scheduler status is superseded by this update. See PRODUCTION_CHECKLIST.md for release acceptance and remaining feature limits. Complete Dhando parity is not claimed.

Browser acceptance in the isolated SQL fixture also confirmed cart/tender persistence across reload, cash change and receipt totals, stock decrement, server-unreachable cached reload, and durable queued checkout during an API outage. This development-server check does not certify the production service-worker shell or physical devices.

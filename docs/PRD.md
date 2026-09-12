# StoreStock product requirements

Version 2 · September 2026 · Retail-first scope

## Product definition

StoreStock is a mobile-friendly retail POS and multi-shop control plane for Indian kirana, grocery, tapri, pharmacy, hardware, clothing, and small retail teams. A super admin creates independent shops, gives each shop its own login, and sees owner-level performance without mixing inventory or transactions.

Restaurant tables, waiters, kitchen tickets, delivery, and restaurant printing are outside the current retail release.

## Users and permissions

| User | Needs | Access |
|---|---|---|
| Super admin / owner | Create, pause, reactivate, reset, switch shops and compare performance | All shops and owner summaries |
| Shop operator | Sell, receive stock, manage contacts, close cash, review reports | Assigned shop only |
| Cashier (planned) | Make sales and print/share receipts | Assigned shop sales only |

## Functional requirements

### Shop administration

- Owner authentication is rate-limited and server-session based.
- Owner creates multiple empty shops, pauses/reactivates them, resets credentials, and switches between them.
- Shop data, cached data, inventory, sales, and reports are isolated by shop.

### Catalogue and inventory

- Products support name, category, barcode, HSN, tax rate, buying/selling price, unit, expiry, reorder level, and decimal stock.
- Search, filters, camera barcode scan, CSV import, edit, delete, physical count, stale-count checks, and movement audit are available.
- Checkout and receiving stock are atomic and cannot oversell.
- Planned: batch/lot quantities with separate expiry dates.

### Billing and payments

- Multi-item cart supports discounts, weighted quantities, tax-inclusive prices, cash, UPI, card, and credit.
- Cash received can exceed the bill and shows change; stored payment is capped at the invoice total.
- Credit requires a customer and supports partial settlement and outstanding balance.
- Immutable invoice snapshots preserve historical product, price, tax, customer, shop, and tender data.
- Request IDs make retries idempotent.
- Receipts support 58/80 mm browser print/PDF, UPI QR, and user-initiated WhatsApp sharing.

### Customers, suppliers, and cash

- Customer credit and settlement ledgers show outstanding balance.
- Supplier purchases increase stock and record paid/due state.
- Expenses, cash opening, tender totals, returns, and cash closing reconcile for a selected date.
- Returns link to original invoices and preserve history.

### Offline and recurring workflows

- A versioned service-worker shell and last successful shop workspace remain available offline for up to 12 hours.
- Cart, payment details, purchase details, and sale requests persist in IndexedDB.
- Network failures use cached data; authorization and validation errors do not.
- Reconnection retries pending sales and removes only confirmed requests.
- Recurring templates support daily/weekly/monthly schedules with explicit automatic opt-in; the server scheduler is idempotent and retains failures.
- Planned: skip dates and route-wise delivery lists.

### Appearance and input

- Responsive mobile layouts, light/dark themes, four accents, normal/large/extra-large text, cash chips, and optional print dialog are supported.
- Voice entry is available beside editable text, number, date, search, and review fields. Password, file, checkbox, and select controls stay native.
- English and Marathi cover the core counter workflow; complete translation is planned.

## Non-functional requirements

- Supabase is authoritative for authentication, authorization, money, stock, and invoice identity.
- Browser roles cannot query tables directly; writes use scoped RPCs.
- Migrations use verified TLS and are repeatable without demo data.
- CI must pass lint, tests, production build, typecheck, and high-severity audit.
- No database URLs, credentials, or private keys enter the browser bundle or repository.
- Production acceptance includes phones, microphone/camera permissions, printer dimensions, and offline reload.

## Success metrics

- Product lookup to saved sale under 10 seconds for a trained operator.
- New product entry under 30 seconds; 50-item count under 5 minutes.
- Zero duplicate invoices on retry and zero cross-shop reads/writes in authorization tests.
- Pending offline requests remain visible, recoverable, and reconcile after connectivity returns.

## Release gaps

Next increments are staff roles, native thermal/label printing, AI purchase import, double-entry accounting/GST filing exports, batch expiry, logo/sounds, complete Marathi translation, and skip/route recurring workflows. Do not advertise these as complete until accepted.

# StoreStock implementation plan

Version 2 · September 2026

## Architecture

- Next.js/Vinext React client with Supabase Postgres as the system of record.
- app/page.tsx owns sessions, owner/shop loading, and scoped RPC adapters.
- app/retail/RetailWorkspace.tsx owns counter workflows and tabs.
- app/retail/domain.ts contains money, quantity, reporting, CSV, invoice, and workspace types.
- app/retail/offline.ts contains versioned IndexedDB cache, drafts, and idempotent pending sales.
- public/retail-sw.js caches the shell and static assets; API responses are never cached.
- app/retail/Appearance.tsx applies device theme, accent, text size, and print preferences.
- app/landing/* contains the public product experience and motion primitives.

## Server invariants

1. retail_action takes a shop advisory lock, validates the payload, and commits stock plus ledger changes atomically.
2. (shop_id, request_id) makes checkout and scheduled billing idempotent.
3. Invoice snapshots preserve historical prices, tax, customer, and shop details.
4. can_access_shop permits only the owner or assigned active shop session.
5. Login failures are throttled; paused shops cannot receive new sessions.
6. Migration clients verify Supabase's published CA.

## Implemented workflow map

| Area | Implementation | Verification |
|---|---|---|
| Multi-shop | Owner RPCs, isolation, pause/reset/switch | Live rollback smoke test and SQL tests |
| Billing | Atomic cart checkout, tax snapshots, tender and credit | Retry, stock, balance, return tests |
| Inventory | Product lifecycle, decimal units, barcode, count audit | Validation and stale-count tests |
| Purchases | Supplier contacts, receiving, dues, settlement | Purchase stock and balance tests |
| Cash/reports | Register, expenses, date reports, CSV | Reconciliation and report tests |
| Offline | Service worker, IndexedDB outbox, recovery and auto sync | Outbox tests and browser outage check |
| Recurring | Opt-in scheduler, idempotent invoices, retained errors | Scheduler tests and live cron registration |
| Input | Voice fields, camera barcode, OCR review | Voice/UI tests; device acceptance pending |
| Appearance | Responsive CSS, dark/light, accents, text sizes | Desktop/mobile browser inspection |

## Delivery phases

### Phase 1 — production retail core (complete)

Ship retail workflows, migrations, security controls, offline queue, scheduler, responsive shell, appearance preferences, CI checks, and truthful landing content. New automatic behavior remains opt-in.

### Phase 2 — team and hardware (next)

Add shop-scoped staff accounts, owner/cashier permissions, first-login reset, logo upload, and a printer adapter selected against confirmed Android, iPhone, Windows, and printer models. Keep browser printing as fallback.

### Phase 3 — finance and import

Add double-entry accounts, journal entries, balance sheet, trial balance, cash flow, GSTR exports, and a reviewed purchase-import provider. Require fixture-based examples and accountant review.

### Phase 4 — inventory depth and recurring delivery

Add batch/lot quantities, expiry alerts, skip dates, route lists, and customer reminders without rewriting movement or invoice history.

### Phase 5 — optional restaurant module

Only if scope changes: tables, floor plan, KOT, kitchen status, waiters, takeaway, delivery, and kitchen printers should be a separate module with separate acceptance criteria.

## Quality gates

Before each release run: npm ci, npm run lint, npm test, npm run build, npm run typecheck, npm audit --audit-level=high, and npm run verify:live.

Then test the deployed URL with two shops, mobile widths, offline reload/reconnect, voice permission, camera scanning, receipt dimensions, and target printer hardware. Never mark a vendor-advertised capability complete from a marketing page alone.

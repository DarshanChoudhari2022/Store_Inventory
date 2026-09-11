# Inventory workspace

## Audit and information architecture

The previous page used large repeated product rows, duplicate sidebar links, unclear symbols, and always-visible management forms. Some navigation labels merely changed sorting. The primary sales form was no longer reachable. Owner administration appeared before daily shop work. At narrow widths, the content either clipped or became excessively tall.

The new hierarchy is:

1. Shop name and date, with manual refresh.
2. Four KPIs: sales, profit, low-stock items (click to filter), total products.
3. Add Sale, Update Stock, Add Item, Daily Closing.
4. Inventory, Today's Sales, Daily Closing navigation.
5. Search/category/stock filters and a compact inventory table.

Owner administration is retained in an expandable section. Each action opens a native modal dialog with keyboard focus management, Escape handling, validation, disabled pending controls, and retained entries on failure. Mobile inventory rows expose all columns as a labeled two-column list. The document is the main scrolling surface; only the wide sales log and owner table scroll horizontally on small screens.

## Components and state

- `app/page.tsx`: existing sign-in, session restoration, owner administration, loading and shop selection.
- `app/inventory/InventoryWorkspace.tsx`: daily workspace, filters, KPIs, sales, closing, action dialogs.
- `app/inventory/domain.ts`: shared item/sale types, price display, stock classification, IST date, validation and CSV generation.
- `app/inventory/copy.ts`: English and Marathi labels. Filter values are language-independent.
- `app/inventory/inventory.css`: scoped compact and responsive UI.

Supabase remains authoritative. The client refetches the shop after confirmed writes, on window focus, and every minute while visible with no form open. Search and category filtering are immediate local operations over the loaded inventory. No product or sales data is seeded or persisted in browser storage. Language preference and the existing authentication session use browser storage.

Sales revenue = quantity x sold price; profit = quantity x (sold price - cost at sale). Sale records snapshot names and costs. Product edits and deletion therefore do not alter past margins. Stock zero is Out of Stock; a positive count at or below the alert threshold is Low Stock.

## Database update

For your existing Supabase project, run `supabase/migrations/20260909_inventory_workspace.sql` in the SQL Editor as one query. It includes its own transaction and schema-cache reload. No database password is needed in this checkout for that approach.

For a fresh database, apply both files in order, in a single transaction:

1. `supabase/schema.sql`
2. `supabase/inventory-operations.sql`

Or set `DATABASE_URL` in the ignored `.env.local` and run `npm run setup:supabase`. The runner loads both files transactionally and reloads the PostgREST schema cache. It verifies TLS certificates; use the Supabase connection settings and certificate trust appropriate to your host.

Changes:

- `sales.request_id` and a unique per-shop request index support safe retries of the same sale.
- `stock_adjustments` records the old count, new count, item name, shop, actor role, and timestamp.
- `record_sale_v2` validates quantity/price, serializes duplicate submissions, locks the product, and records the sale and stock decrement atomically. Overselling is rejected, never silently truncated.
- `set_stock_checked` rejects a stale physical count when stock has changed since loading. It writes the adjustment and stock update in one transaction.
- `edit_item` changes product metadata/prices/threshold without overwriting stock. `delete_item` preserves sale and adjustment snapshots through nullable foreign keys.
- Shop access checks remain mandatory for each RPC. RLS prevents direct table access from the browser.
- Daily reads and writes use Asia/Kolkata. Historical sale dates are not retroactively rewritten.
- New shops start empty. Setup no longer seeds products/accounts or resets existing passwords. Existing records, including any earlier demo items, are preserved. Delete only the unwanted items through the UI.
- Existing sales/stock RPC names remain compatible with earlier clients.

Daily Closing is a generated summary, not a locked accounting period. It exports the current IST day's sales, profit, stock counts and thresholds as CSV; physical counts are saved separately and audited. Saved immutable close-of-day records, cash reconciliation and date-range reporting are not implemented.

## Connection settings

`.env.local` has the known project URL. Populate:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://yrpuetarxtuvnhenkigr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
DATABASE_URL=your-complete-postgres-connection-string
```

The app needs only the first two values. `DATABASE_URL` is used locally by the migration runner and must never use a `NEXT_PUBLIC_` prefix. You may instead apply the SQL in Supabase's SQL Editor and leave it blank. Do not use a Supabase secret/service-role key in the browser. Production builds need the same public URL and key available at build time, including on Vercel.

Existing logins are preserved. On a completely fresh database, an owner account must be provisioned privately; setup deliberately does not create a shared default password.

## Verification and deployment

`npm test` runs domain checks plus a temporary PostgreSQL-compatible PGlite database with pgcrypto. The suite executes the actual SQL, verifies sales/stock/authorization, deletion history, retry idempotency and migration reruns. It does not connect to or mutate production. It cannot establish cross-connection concurrency behavior because PGlite uses one connection.

Run `npm run build` and lint before deployment. Live Supabase login/RPC smoke tests and desktop/mobile browser interaction checks are still required before calling the deployment production-ready. The current custom authentication remains in place; auth migration and offline sale queues are outside this redesign.

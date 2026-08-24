# Performance And Scalability Review

## Verdict

The current app is a strong MVP for a Pune store inventory product and is now much healthier after the Supabase integration. It is good enough for pilot usage across a small number of shops, but it is not yet a mature 100-store SaaS system.

Current stack rating: **7/10**

It is fast to build, easy to deploy, and good for a lean product. It loses points for custom authentication, browser-heavy orchestration, limited reporting structure, no automated tests, no offline queue, and no production observability.

## Mental Model

The system has three layers:

- Browser app: owner/shop workflows, forms, dashboard rendering, optimistic local updates.
- Supabase RPC layer: controlled API boundary for login, shop management, inventory, stock, and sales.
- Postgres data model: durable source of truth for shops, items, sales, and sessions.

For 100 stores, the dominant path is not page rendering. It is repeated counter operations: record sale, adjust stock, load dashboard, and owner summary. These paths must avoid table scans, unnecessary round trips, and full dashboard reloads.

## Bottlenecks Found

- Full dashboard reload after every sale, stock update, and item addition.
- Owner refresh called shop refresh twice in some paths.
- Missing indexes for the query patterns used by RPC functions.
- Closing stock blur could send an update even when stock did not change.
- One large client component mixes data access, mapping, rendering, and mutations.
- Owner summary aggregates scan all sales/items; acceptable now, but not ideal as history grows.
- No pagination or archive strategy for long sales history.
- No automated performance regression tests.

## Implemented Improvements

- Added Postgres indexes for sessions, shop items, sales by date, and low-stock scans.
- Changed `update_stock` RPC to return the updated item.
- Changed `record_sale` RPC to return the remaining stock.
- Updated client mutations to patch local state after successful writes.
- Removed unnecessary full dashboard refreshes after item add, stock update, and sale entry.
- Avoided stock update RPC when the closing count value did not change.
- Memoized stable leaf components.

## Next Improvements For 100 Stores

- Replace custom sessions with Supabase Auth or OTP login.
- Add `daily_shop_metrics` table or materialized rollup for owner dashboard summaries.
- Add `stock_adjustments` audit table for closing stock changes.
- Add sales pagination and date filters.
- Add offline queue for shop counters with unreliable mobile internet.
- Add Playwright end-to-end tests for sale, stock, shop creation, and shop login.
- Add database tests for RPC access boundaries.
- Add observability: Supabase query monitoring, frontend error logging, slow RPC tracking.
- Split `app/page.tsx` into data service, mappers, owner dashboard, shop dashboard, table, and forms.

## Recommended Production Stack

- Frontend: Next/Vinext + React + TypeScript.
- Database: Supabase Postgres.
- Auth: Supabase Auth with owner/shop/helper roles.
- API boundary: Postgres RPC or server-side route handlers; avoid direct browser table writes.
- Testing: Playwright, Vitest, pgTAP for database permissions.
- Monitoring: Supabase query performance tools plus browser error reporting.
- Offline support: IndexedDB queue for sales and stock updates.

## Final Stack Rating

- MVP: **8/10 after this pass**
- 100-store production readiness: **6.5/10**
- With Auth, rollups, tests, offline queue, and observability: **9/10**

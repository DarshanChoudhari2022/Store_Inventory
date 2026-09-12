# StoreStock system review

Reviewed September 12, 2026 against the current retail POS requirements and the published Dhando retail workflow.

## Mental model

StoreStock is a multi-tenant retail control plane. The super admin owns the tenant directory and creates independent shops. Each shop owns its catalogue, contacts, invoices, purchases, payments, expenses, register sessions and recurring templates. Operators receive a scoped session and the database is the final authorization boundary.

The browser is an offline-capable counter client: it keeps drafts and a retry-safe sale outbox locally, while Postgres remains the source of truth for stock, money and audit history. Every mutation travels through a transactional RPC with a request id so a retry cannot duplicate a bill.

This is the right shape for a small retail POS: the counter needs speed and resilience, while the owner needs isolation, reconciliation and oversight. The main architectural risk is the custom username/password session layer. It is deliberately hardened, but it carries more security and account-recovery responsibility than managed Supabase Auth.

## Stack score

**9 / 10 for a production retail MVP after this hardening pass.**

| Area | Score | Verdict |
|---|---:|---|
| Product fit | 9/10 | Strong retail flow, clothing variants, multi-shop control and offline drafts. |
| Data integrity | 9/10 | Postgres transactions, stock checks, immutable invoice snapshots and idempotent requests are excellent foundations. |
| Security | 7/10 | RLS/revoked grants, bcrypt, throttling, scoped sessions and password deletion are strong; managed auth and formal audit monitoring would improve it. |
| UX | 8/10 | Responsive, keyboard/mobile friendly, voice entry, barcode camera, receipt sharing and themes. Native printer/device acceptance is still needed. |
| Maintainability | 7/10 | TypeScript and domain helpers are clear, but a single large workspace component and hand-written SQL migrations need more modular boundaries. |
| Operations | 9/10 | CI, dependency audit, live smoke verification, secure headers, migration ledger and backup/restore scripts are in place; hosted alert routing still needs to be wired to the team's on-call channel. |
| Scalability | 7/10 | Relational design scales for small chains; reporting projections, pagination and background jobs will matter as transaction volume grows. |

## Improvements implemented in this review

- Added GitHub Actions CI for install, high-severity dependency audit, lint, typecheck, tests and production build.
- Added clickjacking, opener, DNS-prefetch and production HSTS headers.
- Added a recoverable application error boundary that avoids exposing database details.
- Updated the production checklist to match the implemented cashier/manager roles.
- Added migration ledger bookkeeping and guarded custom-format backup/restore scripts.

## Recommended next investments

1. Move operator authentication to Supabase Auth with app metadata roles, or introduce a dedicated server session endpoint with HttpOnly cookies and refresh/revocation semantics.
2. Wire failed RPCs, cron jobs, login throttles and outbox rejection rates into the team's alerting channel.
3. Split `RetailWorkspace` into feature modules and add browser-level mobile/offline acceptance tests against a deployed preview.
4. Add pagination/reporting read models before shops accumulate large invoice histories.
5. Complete retail parity with native thermal/label adapters, GSTR-1/GSTR-3B exports, full accounting statements, batch/lot expiry, logo/sound settings and reviewed multi-page purchase extraction.

The system is ready for a controlled retail pilot after device testing and a restore drill. It should not be marketed as feature-for-feature identical to Dhando until those remaining device, accounting and operations capabilities are accepted.

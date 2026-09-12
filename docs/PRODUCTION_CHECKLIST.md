# Production release checklist

Validated September 12, 2026. This is a retail POS; restaurant workflows are outside the agreed scope.

## Application and database

- Install reproducibly with `npm ci`; run `npm run lint`, `npm test`, `npm run build`, and `npm run typecheck`.
- GitHub Actions repeats these checks and the dependency audit without production credentials.
- Configure Vercel's production branch as `main` and its Next.js framework preset. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to this project's public settings.
- Keep `DATABASE_URL` only in ignored local environment or a protected migration runner. Never configure it as a public variable or put it in the browser bundle.
- Run `npm run migrate:retail` before the release. It applies the complete base and retail migrations in one transaction, preserves existing records, and refreshes PostgREST. Migration connections verify Supabase's certificate using the bundled public CA.
- Run `npm run verify:live`. It creates temporary accounts inside a transaction, verifies independent shops, retry-safe checkout, balances, and denied cross-shop access, then rolls back all verification records. It also checks the scheduler registration.
- Newly created shops start empty. Existing records are preserved. No default credentials are seeded.

## Operations

- Automatic recurring invoices are opt-in per template. The server checks every five minutes. Failures retain their due date and show an error; failed stock checks do not post invoices. Disable automatic billing on a template to stop further occurrences.
- Review rejected offline bills before correcting them. Pending bills retain their request identity through reconnection and reauthentication; avoid clearing browser storage while bills are pending.
- Cached access lasts at most 12 hours. Server authorization remains mandatory for writes; offline access cannot immediately learn about a remotely revoked session.
- Login attempts are limited by username to ten failures per fifteen-minute window. Administrators can reset shop credentials and pause shop access.
- Monitor Supabase database capacity, error logs, and `cron.job_run_details`. Arrange database backups and a tested restore process according to the hosting plan. A backup policy is not configured by these migrations.

## Release acceptance still requiring the deployment/devices

- Open the deployed URL and verify owner login, creation of two shops, each shop's own login and records, and responsive checkout.
- Test offline reload, queued checkout, reconnection, and conflicting stock on actual counter devices. Automated tests validate outbox persistence and retry identity, not all browser eviction/network behavior.
- Verify microphone permission and English/Marathi recognition on supported browsers. Browser speech services can process audio online.
- Verify camera scanning, OCR accuracy, and physical receipt/label dimensions with the chosen equipment. Printing uses the browser dialog; direct Bluetooth/USB integrations are not implemented.
- Test light/dark mode, larger text, and optional automatic print dialogs on the shop devices.

## Scope limits

The app supports retail billing, products, stock counts, customer/supplier dues, purchases, returns, cash reconciliation, reports, receipt sharing, recurring templates, and isolated shop accounts. Current reporting is not full double-entry accounting or GST filing. OCR requires review and is not a guaranteed handwritten-invoice parser. Granular staff roles, batch-level expiry, complete Marathi translation, and native printer integrations remain separate work. Do not advertise complete Dhando parity or device certification.

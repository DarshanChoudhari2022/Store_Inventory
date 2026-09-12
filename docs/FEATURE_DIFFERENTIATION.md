# StoreStock vs Dhando POS

Compared with Dhando POS's public feature pages on September 12, 2026. Dhando's descriptions are vendor claims; this matrix describes what is implemented and verified in StoreStock.

| Capability | Dhando POS publicly advertises | StoreStock today | Difference |
|---|---|---|---|
| Retail billing | Fast GST billing with cash, card, UPI and credit | Atomic multi-item retail invoices, cash/card/UPI/credit, tax-inclusive prices, payment snapshots and retry-safe request IDs | **StoreStock is strong on transaction integrity; Dhando's speed claim is not independently verified.** |
| GST | CGST, SGST, IGST, HSN and GSTR-1/GSTR-3B preparation | Shop GSTIN, HSN, tax rates, inclusive tax calculation, CGST/SGST or IGST receipt splits and snapshots | **Gap:** no GSTR filing export or e-invoice submission. |
| Offline mode | Bills, printing and automatic sync while offline; claims cart, contacts and catalogue sync | Cached shop workspace, persistent sale outbox, reconnect/interval sync, request-id deduplication, draft recovery and conflict-safe server stock | **Gap:** no final invoice or native printer output while fully offline; queued bills are clearly pending until server sync. |
| Printing | Direct Bluetooth, USB and serial thermal printing; 58/80 mm; auto-print and UPI QR | Browser print/PDF dialog, 58/80 mm receipt layouts, UPI QR, optional automatic print dialog | **Gap:** no direct Bluetooth/USB/serial adapter or device certification. |
| Price labels | 50×25, 40×20 and custom labels; Zebra, TSC, Xprinter and Niimbot | Code128 barcode label generation and browser print | **Gap:** no native printer integrations or certified label profiles. |
| Stock | Barcode camera scan, low-stock alerts, expiry tracking and physical count | Barcode camera scan, low-stock filters, decimal quantities, expiry field, stale-count protection and movement audit | **Gap:** expiry is item-level, not batch/lot-level. |
| Purchases | AI reads printed or handwritten supplier bills, merges multi-page invoices and updates stock after confirmation | Camera OCR review flow, manual confirmation, supplier purchases, stock movements and supplier dues | **Gap:** OCR is review-assisted text extraction, not a reliable AI handwritten/multi-page parser. |
| Customer credit | Udhaar ledger, outstanding balances and payment adjustment | Customer credit sales, partial settlements, balances and receipt history | **StoreStock supports the core ledger;** Dhando advertises reminder-oriented follow-up. |
| Supplier dues | Supplier balances and partial payment tracking | Supplier contacts, purchase due/paid state and settlement | Core parity is present. |
| Reports/accounting | P&L, GST reports, balance sheet, trial balance, cash flow and separate cash/bank/UPI accounts | Date-range sales, gross/net profit, expenses, cash register reconciliation, tender totals and CSV export | **Gap:** no full double-entry accounting statements or GST filing reports. |
| Recurring billing | Daily/weekly/monthly schedules, skip dates and route-wise delivery lists | Recurring templates, explicit opt-in automatic scheduler every five minutes, idempotent invoice generation and retained errors | **Gap:** no skip-date control or route-wise delivery list. |
| Multi-shop | Multiple branches with separate stock, sales and reports | Super admin creates independent empty shops, separate logins, switching, pause/reset access and owner summary | **StoreStock is stronger on explicit shop isolation and admin controls;** Dhando advertises branch switching. |
| Staff | 1 or 3 users, owner/cashier roles | Owner and shop login roles | **Gap:** no multiple staff accounts or cashier permissions inside a shop. |
| Customization | Dark mode, four accents, Hindi/Marathi fonts, text size, sounds, logo and denomination chips | Light/dark mode, four accents, text size, English/Marathi labels, cash chips and optional print dialog | **Gap:** no logo upload, sound effects, or complete Marathi translation. |
| Restaurant | Tables, floor plan, KOT, kitchen status, waiter assignment, takeaway and delivery | Retail-first product only | **Gap by agreed scope:** restaurant workflows are not implemented. |
| Sharing | One-tap WhatsApp invoice and reminders | User-initiated WhatsApp receipt sharing and CSV downloads | Core invoice sharing is present; automated reminders are not. |
| Platform | Android/iPhone PWA, Add to Home Screen | Responsive browser app with service-worker shell and offline storage | **Requires device acceptance:** PWA install behavior and counter hardware still need validation on the shops' actual devices. |

## Product positioning

StoreStock's differentiation is a retail-first multi-shop control plane: independent shop data, owner-level oversight, server-enforced shop authorization, atomic checkout, idempotent offline reconciliation, audit-friendly stock movements, and a deployable codebase with automated checks. Dhando's differentiators are broader device integrations, accounting depth, AI purchase import and restaurant support.

## Recommended next investment

1. Add staff accounts and cashier permissions per shop.
2. Add native thermal/label printing after the target Android/iPhone/Windows devices and printer models are confirmed.
3. Add a reviewed purchase-import provider for printed and handwritten multi-page invoices.
4. Add double-entry accounting and GSTR-1/GSTR-3B exports only after the tax/accounting rules are specified and tested.
5. Add logo upload, sound preferences, skip dates and route lists.

Do not claim complete Dhando parity until those gaps are implemented and accepted on real devices.

## Implementation update

StoreStock now supports individual full-access shop operators with owner-controlled creation, pause and password reset. Restricted cashier permissions remain a gap. Clothing products now have style/SKU, size, colour, MRP and independent stock, CSV imports and variant duplication. Products can be made inactive while preserving stock; deletion requires the current user's password and retains an audit snapshot. Products referenced by bills are retained for returns.

The app already has manual recurring Skip and Pause/Resume controls; the earlier statement that all skip control is absent was too broad. Advance skip calendars and route-wise delivery lists remain unimplemented.

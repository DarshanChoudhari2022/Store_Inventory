# Product Requirements Document: Tapri Inventory Manager

## 1. Product Summary

Tapri Inventory Manager is a lightweight admin dashboard for a Pune small-shop owner who manages one or more tapris. The owner can create shop accounts, generate usernames and passwords for each shop, maintain shop-wise item lists, record sold products at the actual sale price, update closing stock at the end of each day, and view sales, profit, and stock analysis.

## 2. Problem

Small shop owners often track stock mentally or in a notebook. This creates four recurring problems:

- The owner does not know exact closing stock without manual recounting.
- Daily profit is unclear when items are sold at different prices.
- Fast moving items are discovered late, usually after stock runs out.
- Custom/local items change often, so fixed POS software feels heavy.

## 3. Goals

- Let the admin add any item sold at the shop.
- Let the owner admin add multiple shops.
- Generate username and password credentials for each shop.
- Keep each shop's inventory, sales, and reports separate.
- Track total quantity available for each item.
- Record sales with quantity and actual sold price.
- Calculate revenue, profit, units sold, stock value, and highest selling product.
- Support daily closing stock updates.
- Highlight low-stock items before they run out.
- Keep the interface fast enough for counter use.

## 4. Non-Goals For V1

- GST billing, tax filing, or invoice printing.
- Supplier payment management.
- Enterprise multi-branch accounting.
- Customer loyalty or credit ledger.
- Real payment integration.

## 5. Primary User

The first user is a tapri owner/admin in Pune who may operate multiple counters. He needs to add shops, give each shop a simple login, and still see combined owner-level performance. Shop staff need a focused shop dashboard for daily sales and closing stock.

## 6. Core Workflows

### Owner Admin Login

- Owner opens the app.
- Enters owner username and password.
- Lands on owner admin dashboard.

V1 prototype uses local login only. Production should use mobile OTP or password authentication.

### Add Shop And Generate Credentials

- Owner enters shop name and area.
- App creates a shop record.
- App generates a username and password for that shop.
- Owner can share the credentials with the shop user.
- Owner can reset a shop password later.

### Shop Login

- Shop user enters generated username and password.
- Shop user lands on only that shop's dashboard.
- Shop inventory, sales, profit, and closing stock are scoped to that shop.

### Add Item

- Admin enters item name, category, buying price, selling price, total quantity, and restock alert level.
- Item appears in the shop inventory list.

### Record Sale

- Admin selects an item.
- Enters quantity sold.
- Enters actual sold price per piece.
- App reduces stock and records profit for that sale.

### Closing Stock

- At end of day, admin updates the count for each item after physical checking.
- App saves the corrected stock count.

### Dashboard Review

- Admin sees today's revenue, profit, units sold, stock value, highest selling item, low stock alerts, and daily sales log.
- Owner sees total shops, combined revenue, combined profit, total stock value, and low-stock count across shops.

## 7. Useful Feature Brainstorm

- Marathi/Hindi labels for non-English users.
- Quick sale buttons for top items like Vimal, Gold Flake, Classic, lighter.
- Voice entry: "Vimal 5 sold" for faster counter use.
- Daily closing reminder around shop closing time.
- Supplier restock list generated from low-stock items.
- WhatsApp share of restock list to supplier.
- Credit/udhaar ledger for known customers.
- Expense tracking for rent, helper salary, ice, cups, snacks, delivery.
- Barcode scan for packaged products.
- Offline-first mode with cloud sync later.
- Owner PIN for profit numbers, while helper can only enter sales.
- Shop user permissions, so staff can update sales/stock but cannot see other shops.
- Credential expiry and forced password reset after first login.
- Shop-wise comparison: which tapri has better sales and margins.
- Price change history to understand margin changes.
- Spoilage/damage entry for broken packs or unusable stock.
- Daily cash tally: opening cash, sales cash, expenses, closing cash.
- Simple export to Excel.

## 8. Success Metrics

- Admin can add a new item in under 30 seconds.
- Admin can record a sale in under 10 seconds.
- Closing stock update can be completed in under 5 minutes for 50 items.
- Low-stock alert reduces stockouts for top 10 items.
- Daily profit estimate is visible without manual calculation.

## 9. MVP Scope

Included in current prototype:

- Admin login screen.
- Owner admin login.
- Multiple shop creation.
- Generated shop username and password.
- Shop password reset.
- Shop-scoped login and dashboard.
- Inventory list seeded with common tapri items.
- Add custom item form.
- Record sale form with actual sold price.
- Automatic stock decrement.
- Closing count updates.
- Today's revenue, profit, units sold, stock value, top seller.
- Low-stock analysis.
- Browser local storage persistence.

Production next step:

- Real backend database.
- Secure authentication.
- Password hashing and role permissions.
- Daily reports by date range.
- Data export and backup.

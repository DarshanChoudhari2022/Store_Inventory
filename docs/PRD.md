# Product Requirements Document: Tapri Inventory Manager

## 1. Product Summary

Tapri Inventory Manager is a lightweight admin dashboard for a small Pune shop owner who sells cigarettes, Vimal, pan masala, lighters, tea counter add-ons, and other custom items. The owner can maintain a live item list, record sold products at the actual sale price, update closing stock at the end of each day, and view simple sales, profit, and stock analysis.

## 2. Problem

Small shop owners often track stock mentally or in a notebook. This creates four recurring problems:

- The owner does not know exact closing stock without manual recounting.
- Daily profit is unclear when items are sold at different prices.
- Fast moving items are discovered late, usually after stock runs out.
- Custom/local items change often, so fixed POS software feels heavy.

## 3. Goals

- Let the admin add any item sold at the shop.
- Track total quantity available for each item.
- Record sales with quantity and actual sold price.
- Calculate revenue, profit, units sold, stock value, and highest selling product.
- Support daily closing stock updates.
- Highlight low-stock items before they run out.
- Keep the interface fast enough for counter use.

## 4. Non-Goals For V1

- GST billing, tax filing, or invoice printing.
- Supplier payment management.
- Multi-branch inventory.
- Customer loyalty or credit ledger.
- Real payment integration.

## 5. Primary User

The first user is a tapri/store admin in Pune. He may not want complex software and may operate from a phone or a small laptop. He needs fast item entry, simple numbers, and confidence at day end.

## 6. Core Workflows

### Admin Login

- Admin opens the app.
- Enters username/mobile and password.
- Lands on dashboard.

V1 prototype uses local login only. Production should use mobile OTP or password authentication.

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
- Daily reports by date range.
- Data export and backup.

# Implementation Document

## Current Implementation

The prototype is a Vinext/React app created with the OpenAI Sites scaffold. It now supports an owner admin account plus generated shop accounts.

Key files:

- `app/page.tsx`: client-side inventory manager UI and state logic.
- `app/layout.tsx`: app metadata.
- `app/globals.css`: global styling.
- `docs/PRD.md`: product requirements.
- `docs/DESIGN.md`: design direction.

## Data Model

### Item

```ts
type Item = {
  id: string;
  name: string;
  category: string;
  buyingPrice: number;
  defaultSellingPrice: number;
  stock: number;
  reorderLevel: number;
};
```

### Sale

```ts
type Sale = {
  id: string;
  itemId: string;
  itemName: string;
  qty: number;
  buyingPrice: number;
  soldPrice: number;
  date: string;
};
```

### Shop

```ts
type Shop = {
  id: string;
  name: string;
  area: string;
  username: string;
  password: string;
  items: Item[];
  sales: Sale[];
};
```

### Session

```ts
type Session = {
  role: 'owner' | 'shop';
  shopId?: string;
};
```

## Storage

V1 stores shops, items, sales, and generated credentials in browser local storage under `tapri-inventory-v2`.

This makes the prototype easy to test immediately, but it is not enough for production because data is tied to one browser/device and passwords are visible in local storage.

## Dashboard Calculations

- Revenue: sum of `soldPrice * qty` for today's sales.
- Profit: sum of `(soldPrice - buyingPrice) * qty` for today's sales.
- Units sold: sum of `qty` for today's sales.
- Stock value: sum of `stock * buyingPrice` for all items.
- Highest seller: item with the highest units sold today.
- Low stock: items where `stock <= reorderLevel`.

Owner-level calculations aggregate today's sales and inventory value across all shops.

## Authentication Behavior

Prototype credentials:

- Owner: `owner` / `owner123`
- Seed shop: `fcroad.admin` / `Tapri@4217`

When the owner creates a new shop, the app generates:

- Username: normalized shop slug plus `.admin`
- Password: `Tapri@` plus a random four-digit number

This is for product demonstration only. Production must never store plaintext passwords.

## Production Architecture Recommendation

For a real deployment:

- Frontend: React/Vinext dashboard.
- Backend: API routes or worker handlers.
- Database: SQLite/D1 or Postgres.
- Auth: mobile OTP or password login.
- Storage tables:
- `users`
  - `shops`
  - `items`
  - `sales`
  - `stock_adjustments`
  - `suppliers`
  - `expenses`
- Reports:
  - daily summary
  - weekly item movement
  - margin report
  - low-stock reorder list

## Security Notes

- Prototype login is only a UI gate.
- Production must hash passwords or use OTP auth.
- Generated shop passwords should be temporary and reset on first login.
- Profit dashboard should require owner role.
- Helper role should be limited to sale entry and stock count.

## Testing Plan

Manual MVP checks:

- Login opens dashboard.
- Owner can create a new shop.
- New shop receives generated username and password.
- Generated shop credentials can be used to log in.
- Shop login sees only that shop's inventory.
- Add item persists after page refresh.
- Record sale reduces stock.
- Sale at custom price changes profit correctly.
- Closing count edits stock.
- Low-stock alert appears at or below reorder level.
- Highest seller updates after sales.

Automated tests to add later:

- Unit tests for dashboard calculations.
- Component tests for add item and record sale forms.
- End-to-end test for full daily workflow.

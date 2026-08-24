# Implementation Document

## Current Implementation

The prototype is a Vinext/React app created with the OpenAI Sites scaffold.

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

## Storage

V1 stores items and sales in browser local storage under `tapri-inventory-v1`.

This makes the prototype easy to test immediately, but it is not enough for production because data is tied to one browser/device.

## Dashboard Calculations

- Revenue: sum of `soldPrice * qty` for today's sales.
- Profit: sum of `(soldPrice - buyingPrice) * qty` for today's sales.
- Units sold: sum of `qty` for today's sales.
- Stock value: sum of `stock * buyingPrice` for all items.
- Highest seller: item with the highest units sold today.
- Low stock: items where `stock <= reorderLevel`.

## Production Architecture Recommendation

For a real deployment:

- Frontend: React/Vinext dashboard.
- Backend: API routes or worker handlers.
- Database: SQLite/D1 or Postgres.
- Auth: mobile OTP or password login.
- Storage tables:
  - `users`
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
- Profit dashboard should require owner role.
- Helper role should be limited to sale entry and stock count.

## Testing Plan

Manual MVP checks:

- Login opens dashboard.
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

# Implementation Document

## Current Implementation

The app is a Vinext/React app created with the OpenAI Sites scaffold. It now uses Supabase Postgres as the system of record and supports an owner admin account plus generated shop accounts.

Key files:

- `app/page.tsx`: client-side inventory manager UI and state logic.
- `app/layout.tsx`: app metadata.
- `app/globals.css`: global styling.
- `supabase/schema.sql`: Supabase tables, seed data, RLS lockdown, and RPC functions.
- `scripts/setup-supabase.mjs`: one-time schema setup runner using `DATABASE_URL`.
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
  items: Item[];
  sales: Sale[];
};
```

### Session

```ts
type Session = {
  token: string;
  role: 'owner' | 'shop';
  shopId?: string;
};
```

## Storage

The application stores shop, item, sale, and account data in Supabase Postgres.

The browser stores only the current app session token in local storage. Shop passwords are hashed in Postgres with `pgcrypto`; generated passwords are shown only at creation or reset time.

## Supabase Schema

Tables:

- `owner_accounts`
- `shops`
- `items`
- `sales`
- `app_sessions`

Direct table access is revoked from `anon` and `authenticated`; the browser uses granted RPC functions instead.

RPC functions:

- `login_user`
- `logout_user`
- `list_shops`
- `owner_summary`
- `get_shop_dashboard`
- `create_shop`
- `reset_shop_password`
- `add_item`
- `update_stock`
- `record_sale`

## Dashboard Calculations

- Revenue: sum of `soldPrice * qty` for today's sales.
- Profit: sum of `(soldPrice - buyingPrice) * qty` for today's sales.
- Units sold: sum of `qty` for today's sales.
- Stock value: sum of `stock * buyingPrice` for all items.
- Highest seller: item with the highest units sold today.
- Low stock: items where `stock <= reorderLevel`.

Owner-level calculations aggregate today's sales and inventory value across all shops.

## Authentication Behavior

Seed credentials:

- Owner: `owner` / `owner123`
- Seed shop: `fcroad.admin` / `Store@4217`

When the owner creates a new shop, the app generates:

- Username: normalized shop slug plus `.admin`
- Password: `Store@` plus a random four-digit number

The plaintext password is passed once to Supabase, hashed there, and shown to the owner immediately. Existing passwords are not readable.

## Production Architecture Recommendation

For the next production hardening pass:

- Move from custom app sessions to Supabase Auth or OTP login.
- Add first-login password reset.
- Add roles for owner, shop admin, and helper.
- Add audit tables:
  - `stock_adjustments`
  - `suppliers`
  - `expenses`
- Reports:
  - daily summary
  - weekly item movement
  - margin report
  - low-stock reorder list

## Security Notes

- Direct table access is closed with RLS and revoked grants.
- Browser calls are routed through security-definer RPC functions.
- Passwords are hashed in the database.
- Generated shop passwords should be temporary and reset on first login.
- Profit dashboard should require owner role.
- Helper role should be limited to sale entry and stock count.

## Testing Plan

Manual MVP checks:

- Login opens dashboard.
- Supabase owner login returns a session token.
- Owner can create a new shop.
- New shop receives generated username and password.
- Generated shop credentials can be used to log in.
- Shop login sees only that shop's inventory.
- Add item persists in Supabase.
- Record sale reduces stock.
- Sale at custom price changes profit correctly.
- Closing count edits stock.
- Low-stock alert appears at or below reorder level.
- Highest seller updates after sales.

Automated tests to add later:

- Unit tests for dashboard calculations.
- Component tests for add item and record sale forms.
- End-to-end test for full daily workflow.

# Store Inventory Management

A store inventory dashboard for a Pune store owner/admin. It supports multiple stores, generated store usernames/passwords, store-wise inventory, daily sales, item profit, buying price, selling price, low stock, highest selling product, closing stock updates, and Supabase-backed persistence.

## Run Locally

```bash
npm install
npm run dev
```

Create `.env.local` before running locally:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://yrpuetarxtuvnhenkigr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

For Vercel, add the same two variables in Project Settings > Environment Variables.

## Documentation

- [PRD](docs/PRD.md)
- [Design Doc](docs/DESIGN.md)
- [Implementation Doc](docs/IMPLEMENTATION.md)
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md)

## Current Prototype

- Local admin login screen.
- Owner admin login and shop-specific login.
- Multiple shop creation.
- Generated username/password for each shop.
- Empty inventory for new shops, with category suggestions for shop items.
- Custom item creation.
- Sold product entry with actual sold price.
- Daily revenue, profit, units sold, stock value, and highest seller.
- Low-stock analysis.
- Closing stock update.
- Supabase Postgres persistence through RPC functions.

Existing shop and owner credentials are preserved. No default credentials are created by setup.

## Supabase Setup

Run the database setup with a local `DATABASE_URL` environment variable:

```bash
npm run setup:supabase
```

The setup applies both SQL files in a transaction, preserving records and credentials. It adds validated sales, product edit/delete, audited stock updates, and row-level security.

See [Inventory redesign and database setup](docs/INVENTORY_REDESIGN.md) for the UI audit, new workflows, environment configuration, and verification limits. Run `npm test` for the inventory regression suite.

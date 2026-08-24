# Tapri Inventory Manager

A small-store inventory dashboard for a Pune tapri owner/admin. It supports multiple shops, generated shop usernames/passwords, shop-wise inventory, daily sales, item profit, buying price, selling price, low stock, highest selling product, closing stock updates, and Supabase-backed persistence.

## Run Locally

```bash
npm install
npm run dev
```

## Documentation

- [PRD](docs/PRD.md)
- [Design Doc](docs/DESIGN.md)
- [Implementation Doc](docs/IMPLEMENTATION.md)

## Current Prototype

- Local admin login screen.
- Owner admin login and shop-specific login.
- Multiple shop creation.
- Generated username/password for each shop.
- Seed inventory for cigarettes, Vimal, pan masala, and accessories.
- Custom item creation.
- Sold product entry with actual sold price.
- Daily revenue, profit, units sold, stock value, and highest seller.
- Low-stock analysis.
- Closing stock update.
- Supabase Postgres persistence through RPC functions.

Demo credentials:

- Owner: `owner` / `owner123`
- Shop: `fcroad.admin` / `Tapri@4217`

## Supabase Setup

Run the database setup with a local `DATABASE_URL` environment variable:

```bash
npm run setup:supabase
```

The setup creates tables, seed data, row-level security, and the RPC functions used by the browser app.

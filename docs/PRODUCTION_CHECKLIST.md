# Production Readiness Checklist

## Required Vercel Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://yrpuetarxtuvnhenkigr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
```

Do not add the direct Postgres connection string or database password to Vercel for this browser app.

## Deployment Checks

- `npm install`
- `npm run build`
- Verify Vercel project uses the `main` branch.
- Verify Supabase env vars are added for Production, Preview, and Development if needed.
- Open the deployed URL and confirm CSS is loaded.
- Login as owner and load the dashboard.
- Login as one shop account and confirm only that shop opens.

## Operational Checks

- Rotate the Supabase database password after setup.
- Change the seeded owner password before real use.
- Reset seeded shop passwords before handing to shop staff.
- Keep Supabase RLS enabled.
- Monitor failed login spikes and slow RPC calls.
- Export or back up Supabase data regularly.

## Next Hardening Items

- Replace custom password login with Supabase Auth or OTP.
- Add first-login password reset.
- Add `stock_adjustments` audit table.
- Add date-range reports and daily metric rollups.
- Add Playwright end-to-end tests.
- Add offline queue for sales entry.

-- Immutable release bookkeeping for repeatable production migrations.
create table if not exists public.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from public, anon, authenticated;

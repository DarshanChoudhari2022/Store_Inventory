alter table public.schema_migrations add column if not exists checksum text;
create index if not exists schema_migrations_checksum_idx on public.schema_migrations(checksum);

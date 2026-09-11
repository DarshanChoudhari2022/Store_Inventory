import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadEnvFile } from 'node:process';

try { loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const operations = await readFile(new URL('../supabase/inventory-operations.sql', import.meta.url), 'utf8');
const retail = await readFile(new URL('../supabase/migrations/20260912_retail_pos.sql', import.meta.url), 'utf8');
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: true },
});

try {
  await client.connect();
  await client.query('begin');
  await client.query(sql);
  await client.query(operations);
  await client.query(retail);
  await client.query("notify pgrst, 'reload schema'");
  await client.query('commit');
  console.log('Supabase inventory migration applied. Existing records preserved.');
} catch (error) {
  await client.query('rollback').catch(() => {});
  console.error(error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
} finally {
  await client.end();
}

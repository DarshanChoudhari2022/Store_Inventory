import { readFile } from 'node:fs/promises';
import {databaseClient} from './database-client.mjs';
import { loadEnvFile } from 'node:process';

try { loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }


const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const operations = await readFile(new URL('../supabase/inventory-operations.sql', import.meta.url), 'utf8');
const retail = await readFile(new URL('../supabase/migrations/20260912_retail_pos.sql', import.meta.url), 'utf8');
const client = await databaseClient();

try {
  await client.connect();
  await client.query('begin');
  await client.query(sql);
  await client.query(operations);
  await client.query(retail);
  await client.query(await readFile(new URL('../supabase/migrations/20260913_retail_scheduler.sql',import.meta.url),'utf8'));
  await client.query(await readFile(new URL('../supabase/migrations/20260914_auth_limits.sql',import.meta.url),'utf8'));
  await client.query(await readFile(new URL('../supabase/migrations/20260915_product_control.sql',import.meta.url),'utf8'));
  await client.query(await readFile(new URL('../supabase/migrations/20260916_shop_staff.sql',import.meta.url),'utf8'));
  await client.query(await readFile(new URL('../supabase/migrations/20260917_staff_roles.sql',import.meta.url),'utf8'));
  await client.query(await readFile(new URL('../supabase/retail-cron.sql',import.meta.url),'utf8'));
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

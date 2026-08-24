import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log('Supabase schema is ready.');
} finally {
  await client.end();
}

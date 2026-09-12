import {readFile} from 'node:fs/promises';
import pg from 'pg';
// Supabase's published production CA, from its official dashboard configuration:
// https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json
export async function databaseClient() {
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,
    ssl:{rejectUnauthorized:true,ca:await readFile(new URL('./certs/supabase-prod-ca-2021.crt',import.meta.url),'utf8')}});
}

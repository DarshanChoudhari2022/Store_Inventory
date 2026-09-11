import {readFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import pg from 'pg';
loadEnvFile('.env.local');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
// Supabase's endpoint is encrypted, but its certificate chain may not be in
// the Windows Node trust store.
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});
try{await client.connect();await client.query('begin');await client.query("set local lock_timeout='10s'; set local statement_timeout='60s'");await client.query(await readFile(new URL('../supabase/migrations/20260912_retail_pos.sql',import.meta.url),'utf8'));await client.query("notify pgrst,'reload schema'");await client.query('commit');console.log('Retail migration applied. Existing shops and records preserved.');}catch(e){await client.query('rollback').catch(()=>{});console.error(e.message);process.exitCode=1;}finally{await client.end();}

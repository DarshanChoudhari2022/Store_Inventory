import {readFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {databaseClient} from './database-client.mjs';
loadEnvFile('.env.local');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=await databaseClient();
try{await client.connect();await client.query('begin');await client.query("set local lock_timeout='10s'; set local statement_timeout='60s'");for(const file of ['schema.sql','inventory-operations.sql','migrations/20260912_retail_pos.sql','migrations/20260913_retail_scheduler.sql','migrations/20260914_auth_limits.sql','retail-cron.sql'])await client.query(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));await client.query("notify pgrst,'reload schema'");await client.query('commit');console.log('Retail migration and recurring scheduler applied. Existing shops and records preserved.');}catch(e){await client.query('rollback').catch(()=>{});console.error(e.message);process.exitCode=1;}finally{await client.end();}

import {readFile} from 'node:fs/promises';
import {loadEnvFile} from 'node:process';
import {databaseClient} from './database-client.mjs';
import {migrationFiles} from './migration-files.mjs';
try { loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=await databaseClient();
const files=[...migrationFiles,'retail-cron.sql'];
try{await client.connect();await client.query('begin');await client.query("set local lock_timeout='10s'; set local statement_timeout='60s'");for(const file of files)await client.query(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));for(const file of files)await client.query('insert into schema_migrations(name) values($1) on conflict(name) do nothing',[file]);await client.query("notify pgrst,'reload schema'");await client.query('commit');console.log('Retail migration and recurring scheduler applied. Existing shops and records preserved.');}catch(e){await client.query('rollback').catch(()=>{});console.error(e.message);process.exitCode=1;}finally{await client.end();}

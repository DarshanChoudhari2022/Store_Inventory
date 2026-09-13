import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {databaseClient} from './database-client.mjs';
import {migrationFiles} from './migration-files.mjs';
try { loadEnvFile('.env.local'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const client=await databaseClient(); const files=[...migrationFiles,'retail-cron.sql'];
try { await client.connect(); for (const file of files) { const source=await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'); const expected=createHash('sha256').update(source).digest('hex'); const row=await client.query('select checksum from schema_migrations where name=$1',[file]); if(!row.rows[0]?.checksum) throw new Error(`Migration checksum missing: ${file}`); if(row.rows[0].checksum!==expected) throw new Error(`Migration drift detected: ${file}`); } console.log(`Migration drift check passed for ${files.length} files.`); } finally { await client.end(); }

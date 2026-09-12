import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadEnvFile} from 'node:process';
import {mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
loadEnvFile('.env.local');
const url=process.env.DATABASE_URL;
if(!url) throw new Error('DATABASE_URL is required');
const output=process.env.BACKUP_FILE || `backups/storestock-${new Date().toISOString().replaceAll(':','-').replace(/\.\d{3}Z$/,'Z')}.dump`;
await mkdir(dirname(output),{recursive:true});
const exec=promisify(execFile);
const command=process.platform==='win32'?'pg_dump':'pg_dump';
const args=['--format=custom','--file',output,url];
try { await exec(command,args,{maxBuffer:1024*1024}); console.log(`Database backup written to ${output}`); }
catch(error) { throw new Error(`pg_dump failed. Install PostgreSQL client tools and retry: ${error.message}`); }

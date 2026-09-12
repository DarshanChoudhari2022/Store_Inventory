import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {loadEnvFile} from 'node:process';
loadEnvFile('.env.local');
const url=process.env.DATABASE_URL, file=process.env.BACKUP_FILE;
if(!url) throw new Error('DATABASE_URL is required');
if(!file) throw new Error('BACKUP_FILE is required');
if(process.env.RESTORE_CONFIRM!=='YES') throw new Error('Set RESTORE_CONFIRM=YES after verifying the target database and backup.');
const exec=promisify(execFile);
try { await exec('pg_restore',['--clean','--if-exists','--no-owner','--dbname',url,file],{maxBuffer:1024*1024}); console.log(`Database restored from ${file}`); }
catch(error) { throw new Error(`pg_restore failed: ${error.message}`); }

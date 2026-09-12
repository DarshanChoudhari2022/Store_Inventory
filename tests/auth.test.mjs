import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
test('login limits persist, expire, and deny paused shops without issuing sessions',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try {
  await db.exec('create role anon;create role authenticated;create schema extensions;');
  for(const file of ['schema.sql','inventory-operations.sql','migrations/20260912_retail_pos.sql','migrations/20260914_auth_limits.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.query("insert into owner_accounts(username,password_hash) values('owner',crypt('test-password',gen_salt('bf')))");
  const login=async(name,password)=>(await db.query('select login_user($1,$2) r',[name,password])).rows[0].r;
  for(let n=0;n<10;n++)assert.match((await login('owner','wrong')).error,/Invalid/);
  assert.match((await login('owner','test-password')).error,/Too many/);
  assert.equal((await db.query('select count(*)::int n from app_sessions')).rows[0].n,0);
  await db.query("update login_attempts set window_started=now()-interval '16 minutes'");
  const owner=await login('owner','test-password');assert.equal(owner.role,'owner');
  const shop=(await db.query("select create_shop($1,'Shop','Pune','shop','shop-test-password') r",[owner.token])).rows[0].r;
  await db.query('update shops set active=false where id=$1',[shop.id]);
  assert.match((await login('shop','shop-test-password')).error,/Invalid/);
  await db.query('update shops set active=true where id=$1',[shop.id]);
  assert.equal((await login('shop','shop-test-password')).shopId,shop.id);
  assert.match((await login('owner','x'.repeat(73))).error,/Invalid/);
  await db.exec('set role anon');await assert.rejects(db.query('select * from login_attempts'),/permission denied/);
 }finally{await db.close();}
});

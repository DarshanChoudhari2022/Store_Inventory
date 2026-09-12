import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('password-protected deletion and separate clothing variant stock',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  await db.exec('create role anon;create role authenticated;create schema extensions;');
  for(const file of ['schema.sql','inventory-operations.sql','migrations/20260912_retail_pos.sql','migrations/20260914_auth_limits.sql','migrations/20260915_product_control.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  const call=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
  await db.query("insert into owner_accounts(username,password_hash) values('owner',crypt('owner-test-password',gen_salt('bf'))),('other',crypt('other-test-password',gen_salt('bf')))");
  const owner=await call('login_user',['owner','owner-test-password']);
  const shop=await call('create_shop',[owner.token,'Clothing','Test','clothes','shop-test-password']);
  const shop2=await call('create_shop',[owner.token,'Other shop','Test','clothes2','other-shop-password']);
  const user=await call('login_user',['clothes','shop-test-password']);
  const other=await call('login_user',['clothes2','other-shop-password']);
  assert.equal(other.shopId,shop2.id);
  const action=(name,data)=>call('retail_action',[user.token,shop.id,crypto.randomUUID(),name,JSON.stringify(data)]);
  const create=size=>action('product',{name:'Oxford shirt',category:'Shirts',cost:400,price:600,stock:5,reorder:1,unit:'pcs',style:'OX-01',size,colour:'Navy',mrp:799});
  const small=await create('S'), medium=await create('M');
  const bill=await action('checkout',{lines:[{id:small.id,qty:1,price:600,discount:0}],method:'cash',paid:600});
  assert.match(bill.lines[0].name,/OX-01 · S · Navy/);
  assert.equal((await db.query('select stock from items where id=$1',[small.id])).rows[0].stock,'4.000');
  assert.equal((await db.query('select stock from items where id=$1',[medium.id])).rows[0].stock,'5.000');
  assert.match((await call('delete_item_confirmed',[user.token,small.id,'shop-test-password'])).error,/bill history/);
  await action('product',{id:small.id,name:'Oxford shirt',category:'Shirts',cost:400,price:600,stock:4,expectedStock:4,reorder:1,unit:'pcs',active:false});
  await assert.rejects(action('checkout',{lines:[{id:small.id,qty:1,price:600,discount:0}],method:'cash',paid:600}),/inactive/);
  assert.equal((await db.query('select stock from items where id=$1',[small.id])).rows[0].stock,'4.000');
  await assert.rejects(call('delete_item',[user.token,medium.id]),/Password confirmation/);
  assert.match((await call('delete_item_confirmed',[other.token,medium.id,'other-shop-password'])).error,/access denied/);
  assert.match((await call('delete_item_confirmed',[owner.token,medium.id,'other-test-password'])).error,/Incorrect password/);
  for(let n=0;n<5;n++)assert.match((await call('delete_item_confirmed',[user.token,medium.id,'wrong'])).error,/Incorrect/);
  assert.match((await call('delete_item_confirmed',[user.token,medium.id,'shop-test-password'])).error,/Too many/);
  assert.equal((await db.query('select count(*)::int n from items where id=$1',[medium.id])).rows[0].n,1);
  await db.exec("update login_attempts set window_started=now()-interval '16 minutes'");
  assert.equal((await call('delete_item_confirmed',[user.token,medium.id,'shop-test-password'])).deleted,true);
  const audit=(await db.query('select snapshot from product_deletions where item_id=$1',[medium.id])).rows[0].snapshot;
  assert.equal(audit.size,'M');assert.ok(!JSON.stringify(audit).includes('password'));
  assert.equal((await db.query('select count(*)::int n from retail_invoices where id=$1',[bill.id])).rows[0].n,1);
  const expired=await create('L');await db.query("update app_sessions set expires_at=now()-interval '1 second' where token=$1",[user.token]);
  assert.match((await call('delete_item_confirmed',[user.token,expired.id,'shop-test-password'])).error,/expired/);
  await db.exec('set role anon');await assert.rejects(db.query('select * from product_deletions'),/permission denied/);
 }finally{await db.close();}
});

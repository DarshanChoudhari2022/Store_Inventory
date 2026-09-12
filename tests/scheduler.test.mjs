import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
test('automatic recurring billing is opt-in, isolated, idempotent, and retains failed occurrences',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  await db.exec('create role anon;create role authenticated;create schema extensions;');
  for(const file of ['schema.sql','inventory-operations.sql','migrations/20260912_retail_pos.sql','migrations/20260913_retail_scheduler.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  const call=async(name,...args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
  await db.query("insert into owner_accounts(username,password_hash) values('test-owner',crypt('test-password',gen_salt('bf')))");
  const owner=(await call('login_user','test-owner','test-password')).token;
  const shop=await call('create_shop',owner,'Test Shop','Pune','shop','test-shop-password');
  const other=await call('create_shop',owner,'Other Shop','Pune','other','other-password');
  const token=(await call('login_user','shop','test-shop-password')).token;
  const otherToken=(await call('login_user','other','other-password')).token;
  const action=(name,data)=>call('retail_action',token,shop.id,crypto.randomUUID(),name,JSON.stringify(data));
  const product=await action('product',{name:'Milk',category:'Dairy',cost:10,price:20,stock:1,reorder:0,unit:'pcs',barcode:'',hsn:'',tax:0,expiry:''});
  const contact=await action('contact',{name:'Customer',kind:'customer'});
  const day=(await db.query("select (now() at time zone 'Asia/Kolkata')::date::text d")).rows[0].d;
  const template=await action('recurring',{name:'Milk daily',contactId:contact.id,lines:[{id:product.id,qty:1,price:20}],cadence:'daily',nextDate:day});
  assert.equal(await call('retail_run_schedules'),0);
  await assert.rejects(call('retail_schedule',otherToken,shop.id,template.id,true),/Shop access/);
  await call('retail_schedule',token,shop.id,template.id,true);
  const sessionsBefore=(await db.query('select count(*) n from app_sessions')).rows[0].n;
  assert.equal(await call('retail_run_schedules'),1);
  assert.equal(await call('retail_run_schedules'),0);
  assert.equal((await db.query('select count(*) n from app_sessions')).rows[0].n,sessionsBefore);
  await db.query('update retail_recurring set next_date=$1,last_attempt_at=null where id=$2',[day,template.id]);
  // Same occurrence key cannot create a duplicate even after retry.
  assert.equal(await call('retail_run_schedules'),1);
  assert.equal((await db.query('select count(*)::int n from retail_invoices')).rows[0].n,1);
  const failure=await action('recurring',{name:'No stock',contactId:contact.id,lines:[{id:product.id,qty:5,price:20}],cadence:'daily',nextDate:day});
  await call('retail_schedule',token,shop.id,failure.id,true);
  await call('retail_run_schedules');
  const failed=(await db.query('select next_date::text,last_error from retail_recurring where id=$1',[failure.id])).rows[0];
  assert.equal(failed.next_date,day);assert.match(failed.last_error,/stock/i);
  assert.equal((await db.query('select count(*) n from app_sessions')).rows[0].n,sessionsBefore);
  await db.exec('set role anon');
  await assert.rejects(call('retail_run_schedules'),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from retail_invoices where shop_id=$1',[other.id])).rows[0].n,0);
 }finally{await db.close();}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

test('individual operators are shop isolated, revocable and confirm with their own password',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  await db.exec('create role anon;create role authenticated;create schema extensions;');
  for(const file of ['schema.sql','inventory-operations.sql','migrations/20260912_retail_pos.sql','migrations/20260914_auth_limits.sql','migrations/20260915_product_control.sql','migrations/20260916_shop_staff.sql','migrations/20260917_staff_roles.sql','migrations/20260918_migration_ledger.sql','migrations/20260919_scale_controls.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  const call=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
  await db.query("insert into owner_accounts(username,password_hash) values('owner',crypt('owner-test-password',gen_salt('bf')))");
  const owner=await call('login_user',['owner','owner-test-password']);
  const a=await call('create_shop',[owner.token,'Shop A','Test','shop-a','shop-test-password']);
  const b=await call('create_shop',[owner.token,'Shop B','Test','shop-b','shop-test-password']);
  const staff=(await call('manage_shop_staff',[owner.token,a.id,'create',JSON.stringify({name:'Operator A',username:'operator-a',password:'operator-test-password',role:'manager'})]))[0];
  assert.equal(staff.username,'operator-a');assert.equal(staff.password_hash,undefined);
  await assert.rejects(call('create_shop',[owner.token,'Collision','Test','OPERATOR-A','shop-test-password']),/exists/);
  await assert.rejects(call('manage_shop_staff',[owner.token,a.id,'create',JSON.stringify({name:'Duplicate',username:'shop-a',password:'operator-test-password'})]),/exists/);
  let operator=await call('login_user',['operator-a','operator-test-password']);assert.equal(operator.shopId,a.id);
  await assert.rejects(call('manage_shop_staff',[operator.token,a.id,'list','{}']),/Super admin/);
  await assert.rejects(call('retail_workspace',[operator.token,b.id,'2026-09-12','2026-09-12']),/access/);
  const action=(name,data)=>call('retail_action',[operator.token,a.id,crypto.randomUUID(),name,JSON.stringify(data)]);
  const product=await action('product',{name:'Staff item',category:'General',price:10,cost:5,stock:2,reorder:1,unit:'pcs'});
  assert.match((await call('delete_item_confirmed',[operator.token,product.id,'shop-test-password'])).error,/Incorrect/);
  assert.equal((await call('delete_item_confirmed',[operator.token,product.id,'operator-test-password'])).deleted,true);
  assert.equal((await db.query('select staff_id from product_deletions where item_id=$1',[product.id])).rows[0].staff_id,staff.id);
  await call('manage_shop_staff',[owner.token,a.id,'pause',JSON.stringify({id:staff.id})]);
  assert.match((await call('login_user',['operator-a','operator-test-password'])).error,/Invalid/);
  assert.equal(await call('can_access_shop',[operator.token,a.id]),false);
  await call('manage_shop_staff',[owner.token,a.id,'resume',JSON.stringify({id:staff.id})]);
  operator=await call('login_user',['operator-a','operator-test-password']);assert.ok(operator.token);
  await call('manage_shop_staff',[owner.token,a.id,'reset',JSON.stringify({id:staff.id,password:'new-operator-password'})]);
  assert.equal(await call('can_access_shop',[operator.token,a.id]),false);
  assert.match((await call('login_user',['operator-a','operator-test-password'])).error,/Invalid/);
  assert.ok((await call('login_user',['operator-a','new-operator-password'])).token);
  const cashier=(await call('manage_shop_staff',[owner.token,a.id,'create',JSON.stringify({name:'Cashier A',username:'cashier-a',password:'cashier-test-password',role:'cashier'})])).find(row=>row.username==='cashier-a');
  const cashierSession=await call('login_user',['cashier-a','cashier-test-password']);
  assert.equal(cashier.role, 'cashier');
  await assert.rejects(call('retail_action',[cashierSession.token,a.id,crypto.randomUUID(),'expense',JSON.stringify({description:'Blocked',amount:10,method:'cash'})]),/Cashier accounts/);
  await call('admin_update_shop',[owner.token,a.id,'Shop A','Test',false]);
  assert.match((await call('login_user',['operator-a','new-operator-password'])).error,/Invalid/);
  await db.exec('set role anon');await assert.rejects(db.query('select * from shop_staff'),/permission denied/);
 }finally{await db.close();}
});

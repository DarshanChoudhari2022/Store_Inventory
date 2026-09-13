import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {migrationFiles} from '../scripts/migration-files.mjs';

test('catalogue pages search across all records and preserve sales selectors and tenant boundaries',async()=>{
 const db=new PGlite({extensions:{pgcrypto}});
 try {
  await db.exec('create role anon;create role authenticated;create schema extensions;');
  for(const file of migrationFiles)await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  const call=async(name,...args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;
  await db.exec("insert into owner_accounts(username,password_hash) values('owner',crypt('owner-password',gen_salt('bf')))");
  const owner=await call('login_user','owner','owner-password');
  const shop=await call('create_shop',owner.token,'Shop','Pune','shop','shop-password');
  await call('create_shop',owner.token,'Other','Pune','other','other-password');
  const outsider=await call('login_user','other','other-password');
  await call('manage_shop_staff',owner.token,shop.id,'create',JSON.stringify({name:'Cashier',username:'cashier',password:'cashier-password',role:'cashier'}));
  const cashier=await call('login_user','cashier','cashier-password');
  const action=(name,data)=>call('retail_action',owner.token,shop.id,crypto.randomUUID(),name,JSON.stringify(data));
  for(let n=0;n<61;n++) {
   await action('product',{name:'Product '+String(n).padStart(3,'0'),price:20,cost:10,stock:n,reorder:2,unit:'pcs',barcode:'code'+n,style:n===60?'Needle%':'',category:'General'});
   await action('contact',{name:'Customer '+String(n).padStart(3,'0'),kind:'customer',phone:'900000'+n});
  }
  await action('contact',{name:'Supplier',kind:'supplier'});
  const page=(view,offset=0,query='',low=false,token=owner.token)=>call('retail_workspace_scoped',token,shop.id,'2026-09-01','2026-09-30',view,0,offset,query,low);
  const first=await page('products'), second=await page('products',50);
  assert.equal(first.products.length,50);assert.equal(second.products.length,11);
  assert.equal(first.pageTotals.products,61);assert.equal(second.catalogOffset,50);
  assert.equal(new Set([...first.products,...second.products].map(p=>p.id)).size,61);
  assert.deepEqual((await page('products')).products.map(p=>p.id),first.products.map(p=>p.id));
  assert.equal((await page('products',0,' code60 ')).products[0].barcode,'code60');
  assert.equal((await page('products',0,'%')).products.length,1);
  assert.equal((await page('products',0,'',true)).products.length,3);
  assert.equal((await page('products',0,'missing')).pageTotals.products,0);
  const contacts=await page('customers',50);
  assert.equal(contacts.contacts.length,11);assert.equal(contacts.pageTotals.contacts,61);
  assert.equal((await page('customers',0,'90000060')).contacts.length,1);
  assert.equal((await page('suppliers')).contacts.length,1);
  assert.equal((await page('suppliers',0,'',false,cashier.token)).contacts.length,0);
  assert.equal((await page('products',0,'',false,cashier.token)).products[0].cost,undefined);
  await assert.rejects(page('products',0,'',false,outsider.token),/Shop access/);
  await assert.rejects(page('products',-1),/Invalid catalogue/);
  await assert.rejects(page('products',0,'x'.repeat(201)),/Invalid catalogue/);
  assert.equal((await page('sell')).products.length,61);
  assert.equal((await page('sell')).contacts.length,62);
  const exportPage=await call('retail_report_export_page',owner.token,shop.id,'2026-09-01','2026-09-30',0,50);
  assert.equal(exportPage.invoices.length,0);assert.equal(exportPage.hasMore,false);
  assert.equal((await call('retail_workspace_scoped',owner.token,shop.id,'2026-09-01','2026-09-30','products',0)).products.length,50);
  // The deployment runner replays migrations; ensure overload replacement stays safe.
  for(const file of migrationFiles)await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  assert.equal((await page('products')).pageTotals.products,61);
 } finally {await db.close();}
});

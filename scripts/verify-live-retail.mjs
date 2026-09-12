import assert from 'node:assert/strict';
import {databaseClient} from './database-client.mjs';
process.loadEnvFile('.env.local');
const client=await databaseClient();
const suffix=crypto.randomUUID().replaceAll('-','').slice(0,16);
const username='verification-'+suffix;
const password=crypto.randomUUID();
const call=async(name,args)=>(await client.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
try {
 await client.connect();await client.query('begin');await client.query("set local statement_timeout='30s'");
 await client.query('insert into owner_accounts(username,password_hash) values($1,crypt($2,gen_salt(\'bf\')))',[username,password]);
 const owner=await call('login_user',[username,password]);assert.ok(owner.token);
 const a=await call('create_shop',[owner.token,'Verification A','Test only','a-'+suffix,password]);
 const b=await call('create_shop',[owner.token,'Verification B','Test only','b-'+suffix,password]);
 const sessionA=await call('login_user',['a-'+suffix,password]);
 const sessionB=await call('login_user',['b-'+suffix,password]);
 const action=(name,data,id=crypto.randomUUID())=>call('retail_action',[sessionA.token,a.id,id,name,JSON.stringify(data)]);
 const product=await action('product',{name:'Verification item',category:'Test',price:20,cost:10,stock:5,reorder:1,unit:'pcs',barcode:'verify-'+suffix,hsn:'',tax:0,expiry:''});
 const customer=await action('contact',{name:'Verification customer',kind:'customer'});
 const requestId=crypto.randomUUID();
 const payload={lines:[{id:product.id,qty:2,price:20,discount:0}],contactId:customer.id,method:'cash',paid:10};
 const invoice=await action('checkout',payload,requestId);
 assert.equal(invoice.total,40);assert.equal((await action('checkout',payload,requestId)).id,invoice.id);
 const day=(await client.query("select (now() at time zone 'Asia/Kolkata')::date::text d")).rows[0].d;
 const workspace=await call('retail_workspace',[sessionA.token,a.id,day,day]);
 assert.equal(workspace.products[0].stock,3);assert.equal(workspace.contacts[0].balance,30);
 // A rejected call aborts a Postgres transaction; isolate this expected rejection.
 await client.query('savepoint isolation');
 await assert.rejects(call('retail_workspace',[sessionB.token,a.id,day,day]),/Shop access/);
 await client.query('rollback to savepoint isolation');
 assert.equal((await call('retail_workspace',[sessionB.token,b.id,day,day])).products.length,0);
 await action('settle',{contactId:customer.id,amount:30,method:'upi'});
 assert.equal((await call('retail_workspace',[sessionA.token,a.id,day,day])).contacts[0].balance,0);
 await client.query('rollback');
 assert.equal((await client.query('select count(*)::int n from owner_accounts where username=$1',[username])).rows[0].n,0);
 console.log('Live verification passed: super-admin creates independent shops, both logins work, checkout retries save once, stock and credit reconcile, cross-shop access is denied. All verification records rolled back.');
 const cron=await client.query("select active from cron.job where jobname='storestock-recurring-bills'");
 assert.equal(cron.rows[0]?.active,true);console.log('Recurring scheduler is registered and active.');
} catch(e) {await client.query('rollback').catch(()=>{});console.error(e.message);process.exitCode=1;}
finally {await client.end();}

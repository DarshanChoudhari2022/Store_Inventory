import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {migrationFiles} from '../scripts/migration-files.mjs';

test('accounting and GST exports are shop scoped and cashier blocked', async () => {
  const db = new PGlite({extensions:{pgcrypto}});
  try {
    await db.exec('create role anon;create role authenticated;create schema extensions;');
    for (const file of migrationFiles) await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'));
    const call = async (name, ...args) => (await db.query(`select ${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) value`, args)).rows[0].value;
    await db.exec("insert into owner_accounts(username,password_hash) values('owner',crypt('owner-password',gen_salt('bf')))");
    const owner = await call('login_user', 'owner', 'owner-password');
    const shop = await call('create_shop', owner.token, 'Shop', 'Pune', 'shop', 'shop-password');
    await call('manage_shop_staff', owner.token, shop.id, 'create', JSON.stringify({name:'Cashier', username:'cashier', password:'cashier-password', role:'cashier'}));
    const cashier = await call('login_user', 'cashier', 'cashier-password');
    const action = (name, data) => call('retail_action', owner.token, shop.id, crypto.randomUUID(), name, JSON.stringify(data));
    await action('settings', {gstin:'27ABCDE1234F1Z5', address:'Pune Street', state:'Maharashtra 27'});
    const product = await action('product', {name:'Taxed item', category:'General', price:118, cost:70, stock:5, reorder:1, unit:'pcs', hsn:'0902', tax:18});
    const customer = await action('contact', {kind:'customer', name:'B2B Customer', gstin:'29ABCDE1234F1Z5'});
    await action('checkout', {lines:[{id:product.id, qty:1, price:118, discount:0}], contactId:customer.id, method:'cash', paid:18});
    await action('expense', {description:'Packing', amount:5, method:'cash'});
    const day = (await db.query("select (now() at time zone 'Asia/Kolkata')::date::text d")).rows[0].d;
    const report = await call('retail_accounting_export', owner.token, shop.id, day, day);
    assert.equal(report.gstr3b.outwardTaxable, 100);
    assert.equal(report.gstr3b.cgst, 9);
    assert.equal(report.gstr3b.sgst, 9);
    assert.equal(report.gstr3b.totalTax, 18);
    assert.equal(report.gstr1[0].customerGstin, '29ABCDE1234F1Z5');
    assert.equal(report.trialBalance.find(row => row.account === 'Accounts receivable').debit, 100);
    assert.equal(report.balanceSheet.assets.receivables, 100);
    assert.equal(report.cashFlow.operating.expenses, 5);
    await assert.rejects(call('retail_accounting_export', cashier.token, shop.id, day, day), /Manager/);
  } finally {
    await db.close();
  }
});

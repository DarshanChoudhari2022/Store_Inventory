import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { closingCsv, indiaDate, stockStatus, totals, validateItem } from '../app/inventory/domain.ts';

test('stock states include threshold equality and zero', () => {
  assert.equal(stockStatus({ stock: 0, reorderLevel: 0 }), 'out');
  assert.equal(stockStatus({ stock: 5, reorderLevel: 5 }), 'low');
  assert.equal(stockStatus({ stock: 6, reorderLevel: 5 }), 'in');
});
test('rupee totals retain paise, losses, and deleted item sales', () => {
  const result = totals([{ itemId: null, qty: 3, soldPrice: 10.25, buyingPrice: 8.1 }, { qty: 2, soldPrice: 1, buyingPrice: 2 }]);
  assert.equal(result.qty, 5); assert.equal(result.revenue, 32.75); assert.equal(result.profit, 4.45);
});
test('daily boundary is IST, not browser or database timezone', () => {
  assert.equal(indiaDate(new Date('2026-09-08T18:29:59Z')), '2026-09-08');
  assert.equal(indiaDate(new Date('2026-09-08T18:30:00Z')), '2026-09-09');
});
test('item validation rejects malformed quantities and prices', () => {
  const valid = { name: 'Tea', category: 'Kirana', stock: 2, reorderLevel: 1, buyingPrice: 2.25, defaultSellingPrice: 3 };
  assert.ok(validateItem(valid));
  for (const bad of [{ stock: 1.5 }, { stock: -1 }, { buyingPrice: NaN }, { name: ' ' }, { defaultSellingPrice: -1 }, { buyingPrice: 1.234 }, { reorderLevel: 2147483648 }]) assert.equal(validateItem({ ...valid, ...bad }), false);
});
test('closing CSV preserves Marathi, quotes, and formula safety', () => {
  const csv = closingCsv({ shop: { name: '=HYPERLINK("bad")' }, items: [{ name: 'चहा, लहान', category: 'Kirana', stock: 2, buyingPrice: 1, defaultSellingPrice: 2, reorderLevel: 1 }], todaysSales: [] });
  assert.ok(csv.includes("'=HYPERLINK")); assert.ok(csv.includes('"चहा, लहान"'));
});

test('Postgres inventory workflows and authorization', async t => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec('create role anon; create role authenticated; create schema extensions;');
    const schema = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    const operations = await readFile(new URL('../supabase/inventory-operations.sql', import.meta.url), 'utf8');
    const migration = await readFile(new URL('../supabase/migrations/20260909_inventory_workspace.sql', import.meta.url), 'utf8');
    await db.exec(schema); await db.exec(operations);
    const call = async (name, args) => (await db.query(`select ${name}(${args.map((_,i) => '$'+(i+1)).join(',')}) as result`,args)).rows[0].result;
    const owner = (await db.query("insert into app_sessions(role) values('owner') returning token")).rows[0].token;
    const shop = await call('create_shop',[owner,'Test Counter','Pune','test.counter','a-long-test-password']);
    const otherShop = await call('create_shop',[owner,'Other Counter','Pune','other.counter','a-long-test-password']);
    const token = (await db.query("insert into app_sessions(role,shop_id) values('shop',$1) returning token",[shop.id])).rows[0].token;
    const other = (await db.query("insert into app_sessions(role,shop_id) values('shop',$1) returning token",[otherShop.id])).rows[0].token;
    let item;
    await t.test('new stores start empty, with no seeded account or stock', async () => {
      assert.equal((await call('get_shop_dashboard',[token,shop.id])).items.length,0);
      assert.equal((await db.query('select count(*)::int as count from owner_accounts')).rows[0].count,0);
      item = await call('add_item',[token,shop.id,'Tea','Kirana',8.1,10.25,10,3]);
      assert.equal(item.stock,10);
    });
    await t.test('invalid product values rejected server-side', async () => {
      await assert.rejects(call('add_item',[token,shop.id,'Bad','Kirana',-1,5,2,1]),/VALIDATION/);
      await assert.rejects(call('add_item',[token,shop.id,' ','Kirana',1,5,2,1]),/VALIDATION/);
      await assert.rejects(call('add_item',[token,shop.id,'Bad','Kirana',1,5,-2,1]),/VALIDATION/);
    });
    const request = crypto.randomUUID();
    await t.test('sale atomically reduces stock and snapshots cost', async () => {
      const sale = await call('record_sale_v2',[token,shop.id,item.id,3,10.25,request]);
      assert.equal(sale.remainingStock,7);
      const dashboard = await call('get_shop_dashboard',[token,shop.id]);
      assert.equal(dashboard.todaysSales.length,1);
      assert.equal(totals(dashboard.todaysSales).revenue,30.75);
      assert.equal(totals(dashboard.todaysSales).profit,6.45);
    });
    await t.test('same sale retry does not double-decrement stock', async () => {
      const retry = await call('record_sale_v2',[token,shop.id,item.id,3,10.25,request]);
      assert.equal(retry.duplicate,true);
      assert.equal((await call('get_shop_dashboard',[token,shop.id])).items[0].stock,7);
      await assert.rejects(call('record_sale_v2',[token,shop.id,item.id,2,10.25,request]),/VALIDATION/);
    });
    await t.test('overselling rolls back, zero/negative sales rejected', async () => {
      await assert.rejects(call('record_sale_v2',[token,shop.id,item.id,8,10.25,crypto.randomUUID()]),/INSUFFICIENT_STOCK/);
      await assert.rejects(call('record_sale_v2',[token,shop.id,item.id,0,10.25,crypto.randomUUID()]),/VALIDATION/);
      await assert.rejects(call('record_sale',[token,shop.id,item.id,1,-1]),/VALIDATION/);
      assert.equal((await call('get_shop_dashboard',[token,shop.id])).items[0].stock,7);
    });
    await t.test('cross-shop and expired sessions cannot read or mutate', async () => {
      await assert.rejects(call('get_shop_dashboard',[other,shop.id]),/Shop access/);
      await assert.rejects(call('edit_item',[other,item.id,'Bad','Other',1,2,1]),/Shop access/);
      await assert.rejects(call('delete_item',[other,item.id]),/Shop access/);
      await assert.rejects(call('set_stock_checked',[other,item.id,100,7]),/Shop access/);
      await assert.rejects(call('record_sale_v2',[other,shop.id,item.id,1,10,crypto.randomUUID()]),/Shop access/);
      const expired = (await db.query("insert into app_sessions(role,shop_id,expires_at) values('shop',$1,now()-interval '1 hour') returning token",[shop.id])).rows[0].token;
      await assert.rejects(call('get_shop_dashboard',[expired,shop.id]),/Shop access/);
      await db.exec('set role anon;');
      await assert.rejects(db.query('select * from items'),/permission denied/);
      await db.exec('reset role;');
    });
    await t.test('physical count checks stale stock and writes audit record', async () => {
      await assert.rejects(call('set_stock_checked',[token,item.id,9,10]),/STOCK_CHANGED/);
      await call('set_stock_checked',[token,item.id,9,7]);
      const adjustment = (await db.query('select * from stock_adjustments')).rows[0];
      assert.equal(adjustment.previous_stock,7); assert.equal(adjustment.counted_stock,9);
    });
    await t.test('editing a product preserves current stock and historical margins', async () => {
      await call('edit_item',[token,item.id,'New Tea','Drinks',9,12,4]);
      const d = await call('get_shop_dashboard',[token,shop.id]);
      assert.equal(d.items[0].stock,9); assert.equal(d.items[0].buyingPrice,9);
      assert.equal(d.todaysSales[0].itemName,'Tea'); assert.equal(totals(d.todaysSales).profit,6.45);
    });
    await t.test('deletion keeps sales and counted-stock audit history', async () => {
      await call('delete_item',[token,item.id]);
      const d = await call('get_shop_dashboard',[token,shop.id]);
      assert.equal(d.items.length,0); assert.equal(d.todaysSales.length,1); assert.equal(d.todaysSales[0].itemId,null);
      assert.equal(totals(d.todaysSales).revenue,30.75);
      assert.equal((await db.query('select item_id from stock_adjustments')).rows[0].item_id,null);
    });
    await t.test('migration reruns preserve live records and credentials', async () => {
      await db.exec(migration); await db.exec(migration);
      assert.equal((await call('get_shop_dashboard',[token,shop.id])).todaysSales.length,1);
      assert.equal((await call('get_shop_dashboard',[token,shop.id])).items.length,0);
    });
  } finally { await db.close(); }
});

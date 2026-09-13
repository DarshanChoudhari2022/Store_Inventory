import test from 'node:test';
import assert from 'node:assert/strict';
import { receiptText, labelText, escposPayload } from '../app/retail/thermal-printer.ts';

test('thermal receipt text includes GST, split tenders and safe ASCII output', () => {
  const invoice = {
    id:'i1',
    number:'260913-000001',
    customer_id:'c1',
    customer:{name:'Customer A', gstin:'29ABCDE1234F1Z5'},
    shop_snapshot:{name:'StoreStock Demo', area:'Pune', settings:{paper:'58', gstin:'27ABCDE1234F1Z5', address:'Pune Street', phone:'9999999999', upi:'shop@upi', receiptNote:'Visit again'}},
    lines:[{id:'p1', name:'Oxford shirt Navy', qty:1, price:118, discount:0, unit:'pcs', hsn:'6205', rate:18, net:100, tax:18, total:118, cost:60}],
    subtotal:100,
    tax:18,
    total:118,
    cost:60,
    paid:118,
    method:'split',
    tenders:{cash:18, upi:100},
    interstate:false,
    supply_state:'Maharashtra 27',
    created_at:'2026-09-13T12:00:00.000Z',
  };
  const text = receiptText(invoice);
  assert.match(text, /Tax invoice/);
  assert.match(text, /CGST\s+Rs 9/);
  assert.match(text, /SGST\/UTGST\s+Rs 9/);
  assert.match(text, /UPI\s+Rs 100/);
  assert.match(text, /Due at issue\s+Rs 0/);
  assert.doesNotMatch(text, /₹/);
  assert.ok(escposPayload(text).length > text.length);
});

test('thermal label text includes price, mrp, hsn and barcode', () => {
  const text = labelText({id:'p1', name:'Tea', category:'Grocery', buying_price:8, default_selling_price:12, stock:10, reorder_level:2, barcode:'8901234567890', unit:'pcs', hsn:'0902', tax_rate:5, expiry_date:null, mrp:15});
  assert.match(text, /Tea/);
  assert.match(text, /MRP Rs 15/);
  assert.match(text, /HSN 0902/);
  assert.match(text, /Barcode 8901234567890/);
});

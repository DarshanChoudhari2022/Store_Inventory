create or replace function public.retail_accounting_export(p_token uuid,p_shop_id uuid,p_from date,p_to date)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
 taxable_sales numeric:=0; output_tax numeric:=0; gross_sales numeric:=0; cogs numeric:=0; returns_total numeric:=0;
 expenses_total numeric:=0; inventory_value numeric:=0; receivable numeric:=0; payable numeric:=0; cash_balance numeric:=0;
 cash_in numeric:=0; upi_in numeric:=0; card_in numeric:=0; purchase_out numeric:=0; supplier_paid numeric:=0; customer_paid numeric:=0;
 cgst numeric:=0; sgst numeric:=0; igst numeric:=0; gstr1 jsonb; hsn_rows jsonb; trial jsonb; balance jsonb; flow jsonb; gstr3b jsonb;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a range of up to 366 days'; end if;

 with sale_lines as (
  select i.number,i.created_at,i.customer,i.interstate,i.supply_state,
   x.name,x.hsn,x.rate,x.net,x.tax,x.total,x.cost
  from retail_invoices i
  cross join lateral jsonb_to_recordset(i.lines) as x(id uuid,name text,qty numeric,price numeric,discount numeric,unit text,hsn text,rate numeric,net numeric,tax numeric,total numeric,cost numeric)
  where i.shop_id=p_shop_id and i.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and i.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')
 ),
 return_lines as (
  select i.number,r.created_at,i.customer,i.interstate,i.supply_state,
   x.name,x.hsn,x.rate,-x.net as net,-x.tax as tax,-x.total as total,-x.cost as cost
  from retail_returns r join retail_invoices i on i.id=r.invoice_id
  cross join lateral jsonb_to_recordset(i.lines) as x(id uuid,name text,qty numeric,price numeric,discount numeric,unit text,hsn text,rate numeric,net numeric,tax numeric,total numeric,cost numeric)
  where r.shop_id=p_shop_id and r.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and r.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')
 ),
 workpaper as (
  select 'invoice' as entry_type,* from sale_lines
  union all
  select 'credit_note' as entry_type,* from return_lines
 )
 select coalesce(sum(net),0),coalesce(sum(tax),0),coalesce(sum(total),0),coalesce(sum(cost),0),
  coalesce(sum(case when interstate then 0 else round(tax/2,2) end),0),
  coalesce(sum(case when interstate then 0 else tax-round(tax/2,2) end),0),
  coalesce(sum(case when interstate then tax else 0 end),0),
  coalesce(jsonb_agg(jsonb_build_object(
   'type',entry_type,'bill',number,'date',created_at,'customerGstin',coalesce(customer->>'gstin',''),
   'placeOfSupply',supply_state,'item',name,'hsn',hsn,'rate',rate,'taxableValue',net,
   'cgst',case when interstate then 0 else round(tax/2,2) end,
   'sgst',case when interstate then 0 else tax-round(tax/2,2) end,
   'igst',case when interstate then tax else 0 end,'total',total
  ) order by created_at,number),'[]'::jsonb)
 into taxable_sales,output_tax,gross_sales,cogs,cgst,sgst,igst,gstr1
 from workpaper;

 with sale_lines as (
  select i.interstate,x.hsn,x.rate,x.net,x.tax,x.total
  from retail_invoices i
  cross join lateral jsonb_to_recordset(i.lines) as x(id uuid,name text,qty numeric,price numeric,discount numeric,unit text,hsn text,rate numeric,net numeric,tax numeric,total numeric,cost numeric)
  where i.shop_id=p_shop_id and i.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and i.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')
 ),
 return_lines as (
  select i.interstate,x.hsn,x.rate,-x.net as net,-x.tax as tax,-x.total as total
  from retail_returns r join retail_invoices i on i.id=r.invoice_id
  cross join lateral jsonb_to_recordset(i.lines) as x(id uuid,name text,qty numeric,price numeric,discount numeric,unit text,hsn text,rate numeric,net numeric,tax numeric,total numeric,cost numeric)
  where r.shop_id=p_shop_id and r.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and r.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'hsn',hsn,'rate',rate,'taxableValue',round(net,2),
  'cgst',case when interstate then 0 else round(tax/2,2) end,
  'sgst',case when interstate then 0 else tax-round(tax/2,2) end,
  'igst',case when interstate then tax else 0 end,'total',round(total,2)
 ) order by hsn,rate,interstate),'[]'::jsonb)
 into hsn_rows
 from (select hsn,rate,interstate,sum(net) net,sum(tax) tax,sum(total) total from (select * from sale_lines union all select * from return_lines) x group by hsn,rate,interstate) grouped;

 select coalesce(sum(i.total),0) into returns_total
 from retail_returns r join retail_invoices i on i.id=r.invoice_id
 where r.shop_id=p_shop_id and r.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and r.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata');
 select coalesce(sum(amount),0) into expenses_total from retail_expenses where shop_id=p_shop_id and created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata');
 select coalesce(sum(stock*buying_price),0) into inventory_value from items where shop_id=p_shop_id;
 select coalesce(sum(retail_balance(id)) filter(where kind='customer'),0),coalesce(sum(retail_balance(id)) filter(where kind='supplier'),0) into receivable,payable from retail_contacts where shop_id=p_shop_id;
 cash_balance:=retail_cash(p_shop_id,'2000-01-01'::timestamptz);
 select coalesce(sum(case when method='cash' then paid when method='split' then coalesce((tenders->>'cash')::numeric,0) else 0 end),0),
  coalesce(sum(case when method='upi' then paid when method='split' then coalesce((tenders->>'upi')::numeric,0) else 0 end),0),
  coalesce(sum(case when method='card' then paid when method='split' then coalesce((tenders->>'card')::numeric,0) else 0 end),0)
 into cash_in,upi_in,card_in
 from retail_invoices where shop_id=p_shop_id and created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata');
 select coalesce(sum(paid),0) into purchase_out from retail_purchases where shop_id=p_shop_id and created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata');
 select coalesce(sum(p.amount) filter(where c.kind='supplier'),0),coalesce(sum(p.amount) filter(where c.kind='customer'),0)
 into supplier_paid,customer_paid from retail_payments p join retail_contacts c on c.id=p.contact_id where p.shop_id=p_shop_id and p.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and p.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata');

 gstr3b:=jsonb_build_object('outwardTaxable',round(taxable_sales,2),'cgst',round(cgst,2),'sgst',round(sgst,2),'igst',round(igst,2),'totalTax',round(output_tax,2),'grossSales',round(gross_sales,2),'creditNotes',round(returns_total,2));
 balance:=jsonb_build_object('assets',jsonb_build_object('cash',round(cash_balance,2),'receivables',round(receivable,2),'inventory',round(inventory_value,2)),'liabilities',jsonb_build_object('supplierPayables',round(payable,2),'outputGst',round(output_tax,2)),'equity',jsonb_build_object('retainedEarningsWorkpaper',round(taxable_sales-cogs-expenses_total,2)));
 flow:=jsonb_build_object('operating',jsonb_build_object('cashSales',round(cash_in,2),'upiCollections',round(upi_in,2),'cardCollections',round(card_in,2),'customerCollections',round(customer_paid,2),'purchasePayments',round(purchase_out,2),'supplierPayments',round(supplier_paid,2),'expenses',round(expenses_total,2),'netMovement',round(cash_in+upi_in+card_in+customer_paid-purchase_out-supplier_paid-expenses_total,2)));
 trial:=jsonb_build_array(
  jsonb_build_object('account','Cash on hand','debit',greatest(round(cash_balance,2),0),'credit',greatest(round(-cash_balance,2),0)),
  jsonb_build_object('account','Accounts receivable','debit',round(receivable,2),'credit',0),
  jsonb_build_object('account','Inventory','debit',round(inventory_value,2),'credit',0),
  jsonb_build_object('account','Cost of goods sold','debit',round(cogs,2),'credit',0),
  jsonb_build_object('account','Expenses','debit',round(expenses_total,2),'credit',0),
  jsonb_build_object('account','Supplier payables','debit',0,'credit',round(payable,2)),
  jsonb_build_object('account','Sales revenue','debit',0,'credit',round(taxable_sales,2)),
  jsonb_build_object('account','Output GST','debit',0,'credit',round(output_tax,2))
 );
 return jsonb_build_object('from',p_from,'to',p_to,'generatedAt',statement_timestamp(),'gstr1',gstr1,'hsnSummary',hsn_rows,'gstr3b',gstr3b,'trialBalance',trial,'balanceSheet',balance,'cashFlow',flow);
end $$;
revoke all on function public.retail_accounting_export(uuid,uuid,date,date) from public,anon,authenticated;
grant execute on function public.retail_accounting_export(uuid,uuid,date,date) to anon,authenticated;
notify pgrst,'reload schema';

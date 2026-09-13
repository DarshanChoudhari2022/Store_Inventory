-- Exact transactional daily totals: returns are recognized on their return date.
create table if not exists retail_report_daily (
 shop_id uuid not null references shops(id) on delete cascade,
 day date not null,
 sales numeric not null default 0,
 tax numeric not null default 0,
 gross numeric not null default 0,
 expenses numeric not null default 0,
 primary key(shop_id,day)
);
alter table retail_report_daily enable row level security;
revoke all on retail_report_daily from public,anon,authenticated;

create or replace function retail_report_delta(kind text,row_data jsonb,direction integer)
returns void language plpgsql security definer set search_path=public,extensions as $$
declare d date; s uuid:=(row_data->>'shop_id')::uuid;
 v_sales numeric:=0;v_tax numeric:=0;v_gross numeric:=0;v_expenses numeric:=0; original retail_invoices%rowtype;
begin
 d:=((row_data->>'created_at')::timestamptz at time zone 'Asia/Kolkata')::date;
 if kind='retail_invoices' then
  v_sales:=(row_data->>'total')::numeric;v_tax:=(row_data->>'tax')::numeric;
  v_gross:=(row_data->>'subtotal')::numeric-(row_data->>'cost')::numeric;
 elsif kind='retail_returns' then
  select * into strict original from retail_invoices where id=(row_data->>'invoice_id')::uuid and shop_id=s;
  v_sales:=-original.total;v_tax:=-original.tax;v_gross:=-(original.subtotal-original.cost);
 elsif kind='retail_expenses' then v_expenses:=(row_data->>'amount')::numeric;
 elsif kind='sales' then
  if row_data->>'invoice_id' is not null then return;end if;
  d:=(row_data->>'sale_date')::date;
  v_sales:=(row_data->>'qty')::numeric*(row_data->>'sold_price')::numeric;
  v_gross:=(row_data->>'qty')::numeric*((row_data->>'sold_price')::numeric-(row_data->>'buying_price')::numeric);
 else raise exception 'Unknown report source';end if;
 insert into retail_report_daily(shop_id,day,sales,tax,gross,expenses)
 values(s,d,direction*v_sales,direction*v_tax,direction*v_gross,direction*v_expenses)
 on conflict(shop_id,day) do update set
  sales=retail_report_daily.sales+excluded.sales,tax=retail_report_daily.tax+excluded.tax,
  gross=retail_report_daily.gross+excluded.gross,expenses=retail_report_daily.expenses+excluded.expenses;
end $$;
revoke all on function retail_report_delta(text,jsonb,integer) from public,anon,authenticated;

create or replace function retail_report_changed() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
begin
 if tg_op<>'INSERT' then perform retail_report_delta(tg_table_name,to_jsonb(old),-1);end if;
 if tg_op<>'DELETE' then perform retail_report_delta(tg_table_name,to_jsonb(new),1);end if;
 return null;
end $$;
revoke all on function retail_report_changed() from public,anon,authenticated;

-- Rebuild safely on migration reapplication; table locks prevent lost concurrent writes.
lock table retail_invoices,retail_returns,retail_expenses,sales in share row exclusive mode;
delete from retail_report_daily;
insert into retail_report_daily(shop_id,day,sales,tax,gross,expenses)
select shop_id,day,sum(sales),sum(tax),sum(gross),sum(expenses) from (
 select shop_id,(created_at at time zone 'Asia/Kolkata')::date as day,total as sales,tax,subtotal-cost as gross,0::numeric as expenses from retail_invoices
 union all
 select r.shop_id,(r.created_at at time zone 'Asia/Kolkata')::date,-i.total,-i.tax,-(i.subtotal-i.cost),0 from retail_returns r join retail_invoices i on i.id=r.invoice_id
 union all
 select shop_id,(created_at at time zone 'Asia/Kolkata')::date,0,0,0,amount from retail_expenses
 union all
 select shop_id,sale_date,qty*sold_price,0,qty*(sold_price-buying_price),0 from sales where invoice_id is null
) events group by shop_id,day;
do $$ declare name text;begin
 foreach name in array array['retail_invoices','retail_returns','retail_expenses','sales'] loop
  execute format('drop trigger if exists retail_report_changed on %I',name);
  execute format('create trigger retail_report_changed after insert or update or delete on %I for each row execute function retail_report_changed()',name);
 end loop;
end $$;

create or replace function retail_report(p_token uuid,p_shop_id uuid,p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare totals jsonb;receivable numeric;payable numeric;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a range of up to 366 days';end if;
 select jsonb_build_object('sales',round(coalesce(sum(sales),0),2),'tax',round(coalesce(sum(tax),0),2),
  'gross',round(coalesce(sum(gross),0),2),'expenses',round(coalesce(sum(expenses),0),2),'net',round(coalesce(sum(gross-expenses),0),2)) into totals
 from retail_report_daily where shop_id=p_shop_id and day between p_from and p_to;
 select coalesce(sum(retail_balance(id)) filter(where kind='customer'),0),coalesce(sum(retail_balance(id)) filter(where kind='supplier'),0)
 into receivable,payable from retail_contacts where shop_id=p_shop_id;
 return totals||jsonb_build_object('receivable',receivable,'payable',payable,'asOf',statement_timestamp());
end $$;
revoke all on function retail_report(uuid,uuid,date,date) from public;
grant execute on function retail_report(uuid,uuid,date,date) to anon,authenticated;
create index if not exists retail_invoices_customer on retail_invoices(customer_id);
create index if not exists retail_purchases_supplier on retail_purchases(supplier_id);
create index if not exists retail_payments_contact on retail_payments(contact_id);
notify pgrst,'reload schema';

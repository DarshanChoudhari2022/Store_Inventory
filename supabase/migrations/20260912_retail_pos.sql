-- Additive retail operations. All writes are transactional, authenticated and shop-scoped.
alter table app_sessions add column if not exists staff_role text;
alter table shops add column if not exists active boolean not null default true;
alter table shops add column if not exists settings jsonb not null default '{}';
alter table items alter column stock type numeric(14,3);
alter table items alter column reorder_level type numeric(14,3);
alter table sales alter column qty type numeric(14,3);
alter table items add column if not exists barcode text not null default '';
alter table items add column if not exists unit text not null default 'pcs';
alter table items add column if not exists hsn text not null default '';
alter table items add column if not exists tax_rate numeric(5,2) not null default 0 check(tax_rate between 0 and 100);
alter table items add column if not exists expiry_date date;
alter table items add column if not exists style_code text not null default '' check(length(style_code)<=80);
alter table items add column if not exists size text not null default '' check(length(size)<=40);
alter table items add column if not exists colour text not null default '' check(length(colour)<=60);
alter table items add column if not exists mrp numeric(12,2) check(mrp>=0);
alter table items add column if not exists is_active boolean not null default true;
create unique index if not exists retail_barcode on items(shop_id,barcode) where barcode <> '';

create table if not exists retail_contacts (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id),
 kind text not null check(kind in ('customer','supplier')), name text not null,
 phone text not null default '', address text not null default '', gstin text not null default '', created_at timestamptz not null default now()
);
create table if not exists retail_invoices (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id),
 number text not null, customer_id uuid references retail_contacts(id), customer jsonb not null default '{}',
 shop_snapshot jsonb not null, lines jsonb not null, subtotal numeric(14,2) not null, tax numeric(14,2) not null,
 total numeric(14,2) not null, cost numeric(14,2) not null, paid numeric(14,2) not null,
 method text not null check(method in ('cash','upi','card','credit')), interstate boolean not null default false,
 supply_state text not null default '', created_at timestamptz not null default now(), unique(shop_id,number)
);
alter table sales add column if not exists invoice_id uuid references retail_invoices(id);
create table if not exists retail_purchases (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id), supplier_id uuid not null references retail_contacts(id),
 reference text not null, lines jsonb not null, total numeric(14,2) not null, paid numeric(14,2) not null,
 method text not null check(method in ('cash','upi','card')), created_at timestamptz not null default now()
);
create table if not exists retail_payments (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id), contact_id uuid not null references retail_contacts(id),
 amount numeric(14,2) not null check(amount>0), method text not null check(method in ('cash','upi','card')),
 created_at timestamptz not null default now()
);
create table if not exists retail_expenses (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id), description text not null,
 amount numeric(14,2) not null check(amount>0), method text not null check(method in ('cash','upi','card')), created_at timestamptz not null default now()
);
create table if not exists retail_returns (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id), invoice_id uuid not null unique references retail_invoices(id),
 reason text not null, refund numeric(14,2) not null, method text not null check(method in ('cash','upi','card')), created_at timestamptz not null default now()
);
create table if not exists retail_registers (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id),
 opening numeric(14,2) not null check(opening>=0), opened_at timestamptz not null default now(),
 closed_at timestamptz, expected numeric(14,2), counted numeric(14,2), note text not null default ''
);
create unique index if not exists retail_open_register on retail_registers(shop_id) where closed_at is null;
create table if not exists retail_movements (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id), item_id uuid references items(id) on delete set null,
 item_name text not null, quantity numeric(14,3) not null, reason text not null, created_at timestamptz not null default now()
);
create table if not exists retail_requests (
 shop_id uuid not null references shops(id), request_id uuid not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(shop_id,request_id)
);
create table if not exists retail_recurring (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id), customer_id uuid not null references retail_contacts(id),
 name text not null, lines jsonb not null, cadence text not null check(cadence in ('daily','weekly','monthly')),
 next_date date not null, active boolean not null default true, created_at timestamptz not null default now()
);

alter table retail_recurring add column if not exists route text not null default '';
alter table retail_recurring add column if not exists skip_dates date[] not null default '{}';

do $$ declare n text; begin
 foreach n in array array['retail_contacts','retail_invoices','retail_purchases','retail_payments','retail_expenses','retail_returns','retail_registers','retail_movements','retail_requests','retail_recurring'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from anon, authenticated',n);
 execute format('create index if not exists %I on public.%I(shop_id)',n||'_shop_idx',n);
 end loop;
end $$;

create or replace function can_access_shop(p_token uuid,p_shop_id uuid) returns boolean language sql security definer set search_path=public,extensions as $$
 select exists(select 1 from app_sessions s join shops h on h.id=p_shop_id where s.token=p_token and s.expires_at>now() and (s.role='owner' or (s.role='shop' and s.shop_id=p_shop_id and h.active)));
$$;

create or replace function public.admin_update_shop(p_token uuid,p_shop_id uuid,p_name text,p_area text,p_active boolean) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 or length(trim(coalesce(p_area,''))) not between 1 and 120 or p_active is null then raise exception 'Check shop details'; end if;
 update shops set name=trim(p_name),area=trim(p_area),active=p_active where id=p_shop_id;
 if not found then raise exception 'Shop not found'; end if;
 if not p_active then delete from app_sessions where shop_id=p_shop_id; end if;
 return jsonb_build_object('saved',true);
end $$;
create or replace function public.list_shops(p_token uuid) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
begin
 if not is_owner_session(p_token) then raise exception 'Super admin access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'area',s.area,'username',s.username,'active',s.active,'itemCount',(select count(*) from items i where i.shop_id=s.id)) order by s.created_at) from shops s),'[]');
end $$;

-- Outstanding balances derive from the immutable transaction ledger.
create or replace function public.retail_balance(p_contact uuid) returns numeric language sql security definer set search_path=public,extensions as $$
 select case when c.kind='customer' then
 coalesce((select sum(i.total-i.paid) from retail_invoices i where i.customer_id=c.id and not exists(select 1 from retail_returns r where r.invoice_id=i.id)),0)
 else coalesce((select sum(p.total-p.paid) from retail_purchases p where p.supplier_id=c.id),0) end
 -coalesce((select sum(p.amount) from retail_payments p where p.contact_id=c.id),0)
 from retail_contacts c where c.id=p_contact;
$$;
revoke all on function public.retail_balance(uuid) from public,anon,authenticated;

create or replace function public.retail_cash(p_shop uuid,p_since timestamptz) returns numeric language sql security definer set search_path=public,extensions as $$
 select coalesce((select sum(paid) from retail_invoices where shop_id=p_shop and method='cash' and created_at>=p_since),0)
 -coalesce((select sum(paid) from retail_purchases where shop_id=p_shop and method='cash' and created_at>=p_since),0)
 +coalesce((select sum(case when c.kind='customer' then p.amount else -p.amount end) from retail_payments p join retail_contacts c on c.id=p.contact_id where p.shop_id=p_shop and p.method='cash' and p.created_at>=p_since),0)
 -coalesce((select sum(amount) from retail_expenses where shop_id=p_shop and method='cash' and created_at>=p_since),0)
 -coalesce((select sum(refund) from retail_returns where shop_id=p_shop and method='cash' and created_at>=p_since),0);
$$;
revoke all on function public.retail_cash(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.retail_workspace(p_token uuid,p_shop_id uuid,p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare result jsonb; cashier boolean:=exists(select 1 from app_sessions where token=p_token and staff_role='cashier');
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a range of up to 366 days'; end if;
 select jsonb_build_object(
 'shop',jsonb_build_object('id',h.id,'name',h.name,'area',h.area,'active',h.active,'settings',h.settings),
 'products',coalesce((select jsonb_agg(to_jsonb(i)-'shop_id' order by i.name) from items i where i.shop_id=h.id),'[]'),
 'contacts',coalesce((select jsonb_agg((to_jsonb(c)-'shop_id')||jsonb_build_object('balance',retail_balance(c.id)) order by c.name) from retail_contacts c where c.shop_id=h.id and (not cashier or c.kind='customer')),'[]'),
 'invoices',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from retail_invoices i where i.shop_id=h.id and i.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and i.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')),'[]'),
 'purchases',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from retail_purchases p where p.shop_id=h.id and not cashier and p.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and p.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')),'[]'),
 'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from retail_payments p where p.shop_id=h.id and (not cashier or exists(select 1 from retail_contacts c where c.id=p.contact_id and c.kind='customer')) and p.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and p.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')),'[]'),
 'expenses',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from retail_expenses p where p.shop_id=h.id and not cashier and p.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and p.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')),'[]'),
 'returns',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('total',i.total,'tax',i.tax,'subtotal',i.subtotal,'cost',i.cost,'number',i.number)) from retail_returns r join retail_invoices i on i.id=r.invoice_id where r.shop_id=h.id and r.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and r.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')),'[]'),
 'returnedIds',coalesce((select jsonb_agg(r.invoice_id) from retail_returns r where r.shop_id=h.id),'[]'),
 'registers',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('currentExpected',case when r.closed_at is null then r.opening+retail_cash(h.id,r.opened_at) else r.expected end) order by r.opened_at desc) from retail_registers r where r.shop_id=h.id and not cashier and (r.closed_at is null or (r.opened_at at time zone 'Asia/Kolkata')::date between p_from and p_to)),'[]'),
 'movements',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc) from retail_movements m where m.shop_id=h.id and not cashier and m.created_at >= (p_from::timestamp at time zone 'Asia/Kolkata') and m.created_at < ((p_to+1)::timestamp at time zone 'Asia/Kolkata')),'[]'),
 'recurring',coalesce((select jsonb_agg(to_jsonb(r) order by r.next_date) from retail_recurring r where r.shop_id=h.id and not cashier),'[]'),
 'legacy',coalesce((select jsonb_agg(to_jsonb(s)) from sales s where s.shop_id=h.id and not cashier and s.invoice_id is null and s.sale_date between p_from and p_to),'[]')
 ) into result from shops h where h.id=p_shop_id;
 if cashier then result:=retail_redact_cost(result);end if;
 return result;
end $$;

create or replace function public.retail_action(p_token uuid,p_shop_id uuid,p_request_id uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare
 old retail_requests%rowtype; h shops%rowtype; item items%rowtype; contact retail_contacts%rowtype;
 inv retail_invoices%rowtype; reg retail_registers%rowtype; rec retail_recurring%rowtype;
 line jsonb; lines jsonb:='[]'; result jsonb:='{}'; v_id uuid; v_contact uuid; v_number text;
 qty numeric; price numeric; rate numeric; gross numeric; net numeric; tax numeric; discount numeric;
 v_total numeric:=0; v_net numeric:=0; v_tax numeric:=0; v_cost numeric:=0; v_paid numeric:=0; amount numeric; balance numeric;
 method text; v_expected numeric; v_date date:=(now() at time zone 'Asia/Kolkata')::date; v_inter boolean:=false;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') and p_action in ('product','purchase','expense','register_open','register_close','return','settings','recurring','recurring_run','recurring_skip','recurring_toggle') then raise exception 'Cashier accounts can bill and collect payments only'; end if;
 if p_request_id is null or p_action is null or p_data is null then raise exception 'Request details required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 -- Recheck access after waiting for another transaction.
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 select * into old from retail_requests where shop_id=p_shop_id and request_id=p_request_id;
 if found then
   if old.payload<>jsonb_build_object('action',p_action,'data',p_data) then raise exception 'Request already used with different details'; end if;
   return case when exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then retail_redact_cost(old.result) else old.result end;
 end if;
 select * into h from shops where id=p_shop_id;
 if not h.active then raise exception 'Shop is paused. Ask the super admin to reactivate it.'; end if;
 method:=coalesce(p_data->>'method','cash');
 if method not in ('cash','upi','card','credit') then raise exception 'Choose a valid payment method'; end if;

 if p_action='contact' then
   if p_data->>'kind'='supplier' and exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required'; end if;
   if p_data->>'kind' not in ('customer','supplier') or length(trim(coalesce(p_data->>'name',''))) not between 1 and 120 or length(coalesce(p_data->>'phone',''))>20 or length(coalesce(p_data->>'address',''))>500 then raise exception 'Check contact details'; end if;
   insert into retail_contacts(shop_id,kind,name,phone,address,gstin) values(p_shop_id,p_data->>'kind',trim(p_data->>'name'),coalesce(p_data->>'phone',''),coalesce(p_data->>'address',''),upper(coalesce(p_data->>'gstin',''))) returning id into v_id;
   result:=jsonb_build_object('id',v_id);
 elsif p_action='product' then
   qty:=(p_data->>'stock')::numeric; price:=(p_data->>'price')::numeric; amount:=(p_data->>'cost')::numeric; rate:=coalesce((p_data->>'tax')::numeric,0);
   if length(trim(coalesce(p_data->>'name',''))) not between 1 and 120 or length(trim(coalesce(p_data->>'category',''))) not between 1 and 80 or qty is null or qty not between 0 and 999999999 or round(qty,3)<>qty or price is null or price not between 0 and 9999999 or round(price,2)<>price or amount is null or amount not between 0 and 9999999 or round(amount,2)<>amount or rate not between 0 and 100 or (p_data->>'reorder')::numeric not between 0 and 999999999 or p_data->>'unit' not in ('pcs','kg','g','litre','ml','pack') or length(coalesce(p_data->>'barcode',''))>80 then raise exception 'Check product values'; end if;
   if p_data->>'unit' in ('pcs','pack') and trunc(qty)<>qty then raise exception 'Pieces and packs require whole quantities'; end if;
   v_id:=nullif(p_data->>'id','')::uuid;
   if v_id is not null then
     select * into item from items where id=v_id and shop_id=p_shop_id for update;
     if not found then raise exception 'Product not found'; end if;
     if (p_data->>'expectedStock')::numeric is distinct from item.stock then raise exception 'Stock changed. Reload and count again.'; end if;
     update items set name=trim(p_data->>'name'),category=trim(p_data->>'category'),buying_price=amount,default_selling_price=price,stock=qty,reorder_level=(p_data->>'reorder')::numeric,barcode=coalesce(p_data->>'barcode',''),unit=p_data->>'unit',hsn=coalesce(p_data->>'hsn',''),tax_rate=rate,expiry_date=nullif(p_data->>'expiry','')::date where id=v_id;
     insert into retail_movements(shop_id,item_id,item_name,quantity,reason) values(p_shop_id,v_id,concat_ws(' · ',p_data->>'name',nullif(coalesce(p_data->>'style',item.style_code),''),nullif(coalesce(p_data->>'size',item.size),''),nullif(coalesce(p_data->>'colour',item.colour),'')),qty-item.stock,'Physical count / product edit');
   else
     insert into items(shop_id,name,category,buying_price,default_selling_price,stock,reorder_level,barcode,unit,hsn,tax_rate,expiry_date) values(p_shop_id,trim(p_data->>'name'),trim(p_data->>'category'),amount,price,qty,(p_data->>'reorder')::numeric,coalesce(p_data->>'barcode',''),p_data->>'unit',coalesce(p_data->>'hsn',''),rate,nullif(p_data->>'expiry','')::date) returning id into v_id;
     insert into retail_movements(shop_id,item_id,item_name,quantity,reason) values(p_shop_id,v_id,concat_ws(' · ',p_data->>'name',nullif(p_data->>'style',''),nullif(p_data->>'size',''),nullif(p_data->>'colour','')),qty,'Opening stock');
   end if;
   if length(coalesce(p_data->>'style',''))>80 or length(coalesce(p_data->>'size',''))>40 or length(coalesce(p_data->>'colour',''))>60 then raise exception 'Check style, size and colour lengths'; end if;
   if nullif(p_data->>'mrp','')::numeric is not null and (nullif(p_data->>'mrp','')::numeric<price or round(nullif(p_data->>'mrp','')::numeric,2)<>nullif(p_data->>'mrp','')::numeric) then raise exception 'MRP must have at most two decimal places and cannot be below the selling price'; end if;
   update items set style_code=coalesce(p_data->>'style',style_code),size=coalesce(p_data->>'size',size),colour=coalesce(p_data->>'colour',colour),mrp=case when p_data ? 'mrp' then nullif(p_data->>'mrp','')::numeric else mrp end where id=v_id;
   if p_data ? 'active' then update items set is_active=(p_data->>'active')::boolean where id=v_id; end if;
   result:=jsonb_build_object('id',v_id);
 elsif p_action in ('checkout','purchase','recurring_run') then
   if p_action='recurring_run' then
     select * into rec from retail_recurring where id=(p_data->>'id')::uuid and shop_id=p_shop_id and active for update;
     if not found or rec.next_date>v_date then raise exception 'No due recurring bill'; end if;
     if rec.next_date=any(rec.skip_dates) then
       update retail_recurring set next_date=case rec.cadence when 'daily' then rec.next_date+1 when 'weekly' then rec.next_date+7 else (rec.next_date+interval '1 month')::date end where id=rec.id;
       result:=jsonb_build_object('skipped',true,'date',rec.next_date,'templateId',rec.id);
       insert into retail_requests(shop_id,request_id,payload,result) values(p_shop_id,p_request_id,jsonb_build_object('action',p_action,'data',p_data),result);
       return case when exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then retail_redact_cost(result) else result end;
     end if;
     -- A recurring run posts one due occurrence and advances only after successful billing.
     lines:=rec.lines; v_contact:=rec.customer_id; method:='credit';
   else lines:=p_data->'lines'; v_contact:=nullif(p_data->>'contactId','')::uuid; end if;
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 200 then raise exception 'Add between 1 and 200 items'; end if;
   if (select count(distinct x->>'id') from jsonb_array_elements(lines) x)<>jsonb_array_length(lines) then raise exception 'Combine duplicate products in the cart'; end if;
   if v_contact is not null then
     select * into contact from retail_contacts where id=v_contact and shop_id=p_shop_id and kind=case when p_action='purchase' then 'supplier' else 'customer' end;
     if not found then raise exception 'Contact does not belong to this shop'; end if;
   end if;
   if (method='credit' or p_action='purchase') and v_contact is null then raise exception 'Select a contact'; end if;
   if p_action='purchase' and method='credit' then raise exception 'Choose the method for purchase payment'; end if;
   v_inter:=coalesce((p_data->>'interstate')::boolean,false);
   if v_inter and length(trim(coalesce(p_data->>'supplyState','')))<2 then raise exception 'Enter the place of supply'; end if;
   result:='[]';
   for line in select value from jsonb_array_elements(lines) order by value->>'id' loop
     select * into item from items where id=(line->>'id')::uuid and shop_id=p_shop_id for update;
     if not found then raise exception 'Product does not belong to this shop'; end if;
     qty:=(line->>'qty')::numeric; price:=(line->>'price')::numeric; discount:=coalesce((line->>'discount')::numeric,0);
     if qty is null or qty not between 0.001 and 999999999 or round(qty,3)<>qty or price is null or price not between 0 and 9999999 or round(price,2)<>price or discount not between 0 and 100 then raise exception 'Check quantities, prices and discount'; end if;
     if item.unit in ('pcs','pack') and trunc(qty)<>qty then raise exception 'Pieces and packs require whole quantities'; end if;
     gross:=round(qty*price*(1-discount/100),2);
     if gross>9999999999 then raise exception 'Line total is too large'; end if;
     if p_action='purchase' then
       net:=gross; tax:=0;
       update items set stock=stock+qty,buying_price=price where id=item.id;
     else
       if not item.is_active then raise exception 'Product is inactive: %',item.name; end if;
       if item.stock<qty then raise exception 'Insufficient stock for %',item.name; end if;
       if item.expiry_date is not null and item.expiry_date<v_date then raise exception 'Product expired: %',item.name; end if;
       rate:=case when coalesce(h.settings->>'gstin','')<>'' then item.tax_rate else 0 end;
       if rate>0 and (coalesce(h.settings->>'address','')='' or coalesce(h.settings->>'state','')='' or item.hsn='') then raise exception 'Complete shop address/state and product HSN before tax billing'; end if;
       net:=round(gross/(1+rate/100),2); tax:=gross-net;
       update items set stock=stock-qty where id=item.id;
     end if;
     v_total:=v_total+gross; v_net:=v_net+net; v_tax:=v_tax+tax; v_cost:=v_cost+round(qty*item.buying_price,2);
     result:=result||jsonb_build_array(jsonb_build_object('id',item.id,'name',concat_ws(' · ',item.name,nullif(item.style_code,''),nullif(item.size,''),nullif(item.colour,'')),'qty',qty,'price',price,'discount',discount,'unit',item.unit,'hsn',item.hsn,'rate',case when p_action='purchase' then 0 else rate end,'net',net,'tax',tax,'total',gross,'cost',round(qty*item.buying_price,2)));
     insert into retail_movements(shop_id,item_id,item_name,quantity,reason) values(p_shop_id,item.id,concat_ws(' · ',item.name,nullif(item.style_code,''),nullif(item.size,''),nullif(item.colour,'')),case when p_action='purchase' then qty else -qty end,case when p_action='purchase' then 'Purchase received' else 'Sale' end);
   end loop;
   lines:=result;
   v_paid:=case when method='credit' then coalesce((p_data->>'paid')::numeric,0) else coalesce((p_data->>'paid')::numeric,v_total) end;
   if p_action='recurring_run' then v_paid:=0; end if;
   if v_paid not between 0 and v_total or round(v_paid,2)<>v_paid then raise exception 'Payment must be between zero and the bill total'; end if;
   if p_action<>'purchase' and v_paid<v_total and v_contact is null then raise exception 'Choose a customer for the unpaid balance'; end if;
   if method='credit' and v_paid<>0 then raise exception 'Use Cash, UPI or Card for a partial payment'; end if;
   if p_action='purchase' then
     if length(trim(coalesce(p_data->>'reference',''))) not between 1 and 100 then raise exception 'Enter supplier bill reference'; end if;
     insert into retail_purchases(shop_id,supplier_id,reference,lines,total,paid,method) values(p_shop_id,v_contact,p_data->>'reference',lines,v_total,v_paid,method) returning id into v_id;
     result:=jsonb_build_object('id',v_id,'total',v_total);
   else
     v_number:=to_char(v_date,'YYMMDD')||'-'||lpad(((select count(*) from retail_invoices where shop_id=p_shop_id and (created_at at time zone 'Asia/Kolkata')::date=v_date)+1)::text,6,'0');
     insert into retail_invoices(shop_id,number,customer_id,customer,shop_snapshot,lines,subtotal,tax,total,cost,paid,method,interstate,supply_state)
     values(p_shop_id,v_number,v_contact,case when v_contact is null then '{}' else to_jsonb(contact)-'shop_id' end,jsonb_build_object('name',h.name,'area',h.area,'settings',h.settings),lines,v_net,v_tax,v_total,v_cost,v_paid,method,v_inter,coalesce(nullif(p_data->>'supplyState',''),h.settings->>'state','')) returning * into inv;
     for line in select value from jsonb_array_elements(lines) loop
       insert into sales(shop_id,item_id,item_name,qty,buying_price,sold_price,invoice_id) values(p_shop_id,(line->>'id')::uuid,line->>'name',(line->>'qty')::numeric,round((line->>'cost')::numeric/(line->>'qty')::numeric,2),round((line->>'net')::numeric/(line->>'qty')::numeric,2),inv.id);
     end loop;
     result:=to_jsonb(inv);
     if p_action='recurring_run' then update retail_recurring set next_date=case rec.cadence when 'daily' then rec.next_date+1 when 'weekly' then rec.next_date+7 else (rec.next_date+interval '1 month')::date end where id=rec.id; end if;
   end if;
 elsif p_action='settle' then
   select * into contact from retail_contacts where id=(p_data->>'contactId')::uuid and shop_id=p_shop_id;
   if not found then raise exception 'Contact not found'; end if;
   balance:=retail_balance(contact.id); amount:=(p_data->>'amount')::numeric;
   if contact.kind='supplier' and exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required'; end if;
   if amount is null or amount<=0 or amount>balance or round(amount,2)<>amount or method='credit' then raise exception 'Payment exceeds outstanding balance or is invalid'; end if;
   insert into retail_payments(shop_id,contact_id,amount,method) values(p_shop_id,contact.id,amount,method) returning id into v_id;
   result:=jsonb_build_object('id',v_id);
 elsif p_action='expense' then
   amount:=(p_data->>'amount')::numeric;
   if amount is null or amount not between 0.01 and 9999999999 or round(amount,2)<>amount or method='credit' or length(trim(coalesce(p_data->>'description',''))) not between 1 and 250 then raise exception 'Check expense details'; end if;
   insert into retail_expenses(shop_id,description,amount,method) values(p_shop_id,p_data->>'description',amount,method) returning id into v_id;
   result:=jsonb_build_object('id',v_id);
 elsif p_action='register_open' then
   amount:=(p_data->>'amount')::numeric;
   if amount is null or amount not between 0 and 9999999999 or round(amount,2)<>amount then raise exception 'Check opening cash'; end if;
   insert into retail_registers(shop_id,opening) values(p_shop_id,amount) returning id into v_id;
   result:=jsonb_build_object('id',v_id);
 elsif p_action='register_close' then
   select * into reg from retail_registers where shop_id=p_shop_id and closed_at is null for update;
   if not found then raise exception 'Open a register first'; end if;
   amount:=(p_data->>'amount')::numeric;
   if amount is null or amount not between 0 and 9999999999 or round(amount,2)<>amount then raise exception 'Check counted cash'; end if;
   v_expected:=reg.opening+retail_cash(p_shop_id,reg.opened_at);
   update retail_registers set closed_at=now(),expected=v_expected,counted=amount,note=left(coalesce(p_data->>'note',''),500) where id=reg.id;
   result:=jsonb_build_object('expected',v_expected,'difference',amount-v_expected);
 elsif p_action='return' then
   select * into inv from retail_invoices where id=(p_data->>'id')::uuid and shop_id=p_shop_id for update;
   if not found then raise exception 'Invoice not found'; end if;
   if exists(select 1 from retail_returns where invoice_id=inv.id) then raise exception 'Invoice already returned'; end if;
   if length(trim(coalesce(p_data->>'reason','')))<3 or method='credit' then raise exception 'Enter a reason and refund method'; end if;
   -- Customer payments are unallocated ledger entries. Reimburse the settled portion too.
   balance:=case when inv.customer_id is null then 0 else retail_balance(inv.customer_id) end;
   amount:=inv.paid+greatest(0,(inv.total-inv.paid)-greatest(0,balance));
   for line in select value from jsonb_array_elements(inv.lines) order by value->>'id' loop
     update items set stock=stock+(line->>'qty')::numeric where id=(line->>'id')::uuid and shop_id=p_shop_id;
     if not found then raise exception 'Restore the deleted product before returning this bill'; end if;
     insert into retail_movements(shop_id,item_id,item_name,quantity,reason) values(p_shop_id,(line->>'id')::uuid,line->>'name',(line->>'qty')::numeric,'Full bill return: '||inv.number);
   end loop;
   insert into retail_returns(shop_id,invoice_id,reason,refund,method) values(p_shop_id,inv.id,p_data->>'reason',amount,method) returning id into v_id;
   -- Reverse allocated customer settlements without destroying payment history.
   result:=jsonb_build_object('id',v_id,'refund',amount);
 elsif p_action='settings' then
   if length(coalesce(p_data->>'gstin','')) not in (0,15) or length(coalesce(p_data->>'address',''))>500 or length(coalesce(p_data->>'phone',''))>20 or length(coalesce(p_data->>'upi',''))>100 then raise exception 'Check shop settings'; end if;
   update shops set settings=jsonb_build_object('gstin',upper(coalesce(p_data->>'gstin','')),'address',coalesce(p_data->>'address',''),'state',coalesce(p_data->>'state',''),'phone',coalesce(p_data->>'phone',''),'upi',coalesce(p_data->>'upi',''),'receiptNote',left(coalesce(p_data->>'receiptNote','Thank you for shopping with us'),200),'paper',case when p_data->>'paper'='58' then '58' else '80' end) where id=p_shop_id;
   result:=jsonb_build_object('saved',true);
 elsif p_action='recurring' then
   v_contact:=(p_data->>'contactId')::uuid;
   if not exists(select 1 from retail_contacts where id=v_contact and shop_id=p_shop_id and kind='customer') then raise exception 'Choose a customer'; end if;
   lines:=p_data->'lines';
   if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 200 or p_data->>'cadence' not in ('daily','weekly','monthly') or length(trim(coalesce(p_data->>'name','')))<1 or nullif(p_data->>'nextDate','') is null then raise exception 'Check recurring bill details'; end if;
   for line in select value from jsonb_array_elements(lines) loop
     if not exists(select 1 from items where id=(line->>'id')::uuid and shop_id=p_shop_id) or coalesce((line->>'qty')::numeric,0)<=0 or (line->>'price')::numeric is null or (line->>'price')::numeric<0 then raise exception 'Invalid recurring product'; end if;
   end loop;
   insert into retail_recurring(shop_id,customer_id,name,lines,cadence,next_date) values(p_shop_id,v_contact,p_data->>'name',lines,p_data->>'cadence',(p_data->>'nextDate')::date) returning id into v_id;
   result:=jsonb_build_object('id',v_id);
 elsif p_action='recurring_skip' then
   select * into rec from retail_recurring where id=(p_data->>'id')::uuid and shop_id=p_shop_id for update;
   if not found then raise exception 'Recurring bill not found'; end if;
   update retail_recurring set next_date=case rec.cadence when 'daily' then rec.next_date+1 when 'weekly' then rec.next_date+7 else (rec.next_date+interval '1 month')::date end where id=rec.id;
 elsif p_action='recurring_toggle' then
   update retail_recurring set active=not active where id=(p_data->>'id')::uuid and shop_id=p_shop_id;
   if not found then raise exception 'Recurring bill not found'; end if;
 else raise exception 'Unknown retail action';
 end if;
 insert into retail_requests(shop_id,request_id,payload,result) values(p_shop_id,p_request_id,jsonb_build_object('action',p_action,'data',p_data),result);
 return case when exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then retail_redact_cost(result) else result end;
end $$;

-- Include returned customer repayments in the ledger so a return cannot create phantom credit.
create or replace function public.retail_balance(p_contact uuid) returns numeric language sql security definer set search_path=public,extensions as $$
 select case when c.kind='customer' then
 coalesce((select sum(i.total-i.paid) from retail_invoices i where i.customer_id=c.id),0)
 -coalesce((select sum(i.total-r.refund) from retail_returns r join retail_invoices i on i.id=r.invoice_id where i.customer_id=c.id),0)
 else coalesce((select sum(p.total-p.paid) from retail_purchases p where p.supplier_id=c.id),0) end
 -coalesce((select sum(p.amount) from retail_payments p where p.contact_id=c.id),0)
 from retail_contacts c where c.id=p_contact;
$$;
revoke all on function public.retail_workspace(uuid,uuid,date,date),public.retail_action(uuid,uuid,uuid,text,jsonb),public.admin_update_shop(uuid,uuid,text,text,boolean) from public;
grant execute on function public.retail_workspace(uuid,uuid,date,date),public.retail_action(uuid,uuid,uuid,text,jsonb),public.admin_update_shop(uuid,uuid,text,text,boolean) to anon,authenticated;
notify pgrst,'reload schema';

create or replace function public.owner_summary(p_token uuid) returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare d date:=(now() at time zone 'Asia/Kolkata')::date;
begin
 if not is_owner_session(p_token) then raise exception 'Owner access required'; end if;
 return jsonb_build_object('shopCount',(select count(*) from shops),
 'revenue',coalesce((select sum(total) from retail_invoices where (created_at at time zone 'Asia/Kolkata')::date=d),0)-coalesce((select sum(i.total) from retail_returns r join retail_invoices i on i.id=r.invoice_id where (r.created_at at time zone 'Asia/Kolkata')::date=d),0)+coalesce((select sum(qty*sold_price) from sales where sale_date=d and invoice_id is null),0),
 'profit',coalesce((select sum(subtotal-cost) from retail_invoices where (created_at at time zone 'Asia/Kolkata')::date=d),0)-coalesce((select sum(i.subtotal-i.cost) from retail_returns r join retail_invoices i on i.id=r.invoice_id where (r.created_at at time zone 'Asia/Kolkata')::date=d),0)+coalesce((select sum(qty*(sold_price-buying_price)) from sales where sale_date=d and invoice_id is null),0),
 'inventoryValue',coalesce((select sum(stock*buying_price) from items),0),'lowStockCount',(select count(*) from items where stock<=reorder_level));
end $$;


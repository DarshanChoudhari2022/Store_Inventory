create table if not exists public.retail_quotes (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references shops(id),
 customer_id uuid not null references retail_contacts(id), customer jsonb not null,
 lines jsonb not null, total numeric(14,2) not null,
 status text not null default 'quotation' check(status in ('quotation','order','invoiced','cancelled')),
 invoice_id uuid references retail_invoices(id), valid_until date not null,
 created_at timestamptz not null default now()
);
alter table retail_quotes enable row level security;
revoke all on retail_quotes from public,anon,authenticated;
create index if not exists retail_quotes_shop_date on retail_quotes(shop_id,created_at desc,id);
create table if not exists public.retail_quote_products (
 quote_id uuid not null references retail_quotes(id) on delete cascade,
 item_id uuid not null references items(id), primary key(quote_id,item_id)
);
alter table retail_quote_products enable row level security;
revoke all on retail_quote_products from public,anon,authenticated;

create or replace function public.retail_quote_action(p_token uuid,p_shop_id uuid,p_request_id uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare old retail_requests%rowtype; q retail_quotes%rowtype; c retail_contacts%rowtype; item items%rowtype;
 line jsonb; lines jsonb:='[]'; qty numeric; price numeric; discount numeric; total numeric:=0; result jsonb; request_payload jsonb;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required'; end if;
 if p_request_id is null or p_data is null or p_action is null then raise exception 'Request details required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text,0));
 if not can_access_shop(p_token,p_shop_id) or not exists(select 1 from shops where id=p_shop_id and active) then raise exception 'Shop access required'; end if;
 request_payload:=jsonb_build_object('action','quote:'||p_action,'data',p_data);
 select * into old from retail_requests where shop_id=p_shop_id and request_id=p_request_id;
 if found then if old.payload<>request_payload then raise exception 'Request already used with different details'; end if;return old.result;end if;
 if p_action='create' then
  select * into c from retail_contacts where id=(p_data->>'customerId')::uuid and shop_id=p_shop_id and kind='customer';
  if not found then raise exception 'Choose a customer'; end if;
  if nullif(p_data->>'validUntil','')::date is null or (p_data->>'validUntil')::date<(now() at time zone 'Asia/Kolkata')::date then raise exception 'Choose an expiry date today or later'; end if;
  if jsonb_typeof(p_data->'lines') is distinct from 'array' or jsonb_array_length(p_data->'lines') not between 1 and 200 then raise exception 'Add between 1 and 200 products'; end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(p_data->'lines') x)<>jsonb_array_length(p_data->'lines') then raise exception 'Combine duplicate products'; end if;
  for line in select value from jsonb_array_elements(p_data->'lines') loop
   select * into item from items where id=(line->>'id')::uuid and shop_id=p_shop_id and is_active;
   if not found then raise exception 'Product unavailable'; end if;
   qty:=(line->>'qty')::numeric;price:=(line->>'price')::numeric;discount:=coalesce((line->>'discount')::numeric,0);
   if qty is null or qty not between 0.001 and 999999999 or round(qty,3)<>qty or price is null or price not between 0 and 9999999 or round(price,2)<>price or discount not between 0 and 100 or (item.unit in ('pcs','pack') and trunc(qty)<>qty) then raise exception 'Check quantity, price and discount'; end if;
   total:=total+round(qty*price*(1-discount/100),2);
   lines:=lines||jsonb_build_array(jsonb_build_object('id',item.id,'name',concat_ws(' · ',item.name,nullif(item.style_code,''),nullif(item.size,''),nullif(item.colour,'')),'qty',qty,'price',price,'discount',discount,'unit',item.unit));
  end loop;
  insert into retail_quotes(shop_id,customer_id,customer,lines,total,valid_until) values(p_shop_id,c.id,to_jsonb(c)-'shop_id',lines,total,(p_data->>'validUntil')::date) returning * into q;
  result:=to_jsonb(q);
  insert into retail_quote_products(quote_id,item_id) select q.id,(l->>'id')::uuid from jsonb_array_elements(lines) l;
 else
  select * into q from retail_quotes where id=(p_data->>'id')::uuid and shop_id=p_shop_id for update;
  if not found then raise exception 'Quotation not found';end if;
  if p_action='order' and q.status='quotation' then
   if q.valid_until<(now() at time zone 'Asia/Kolkata')::date then raise exception 'Quotation expired. Create a new quotation.';end if;
   update retail_quotes set status='order' where id=q.id returning * into q; result:=to_jsonb(q);
  elsif p_action='cancel' and q.status in ('quotation','order') then
   update retail_quotes set status='cancelled' where id=q.id returning * into q;result:=to_jsonb(q);
  elsif p_action='invoice' and q.status='order' then
   result:=retail_action(p_token,p_shop_id,md5('quote-invoice:'||q.id::text)::uuid,'checkout',jsonb_build_object('lines',q.lines,'contactId',q.customer_id,'method',p_data->>'method','paid',p_data->'paid','interstate',coalesce((p_data->>'interstate')::boolean,false),'supplyState',coalesce(p_data->>'supplyState','')));
   update retail_quotes set status='invoiced',invoice_id=(result->>'id')::uuid where id=q.id;
  else raise exception 'This quotation cannot make that transition';end if;
 end if;
 insert into retail_requests(shop_id,request_id,payload,result) values(p_shop_id,p_request_id,request_payload,result);
 return result;
end $$;
revoke all on function retail_quote_action(uuid,uuid,uuid,text,jsonb) from public;
grant execute on function retail_quote_action(uuid,uuid,uuid,text,jsonb) to anon,authenticated;

create or replace function public.retail_quote_list(p_token uuid,p_shop_id uuid,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare result jsonb;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required';end if;
 if exists(select 1 from app_sessions where token=p_token and staff_role='cashier') then raise exception 'Manager access required';end if;
 if p_offset is null or p_offset<0 then raise exception 'Invalid page';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id),'[]') into result from (select * from retail_quotes where shop_id=p_shop_id order by created_at desc,id limit 51 offset p_offset) q;
 return result;
end $$;
revoke all on function retail_quote_list(uuid,uuid,integer) from public;
grant execute on function retail_quote_list(uuid,uuid,integer) to anon,authenticated;
notify pgrst,'reload schema';

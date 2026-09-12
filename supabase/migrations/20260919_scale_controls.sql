-- Scale controls: bounded reads, report read models, and tenant quotas.
create table if not exists public.shop_quotas (
 shop_id uuid primary key references shops(id) on delete cascade,
 max_products integer not null default 10000 check(max_products between 100 and 1000000),
 max_invoices_month integer not null default 100000 check(max_invoices_month between 1000 and 10000000),
 updated_at timestamptz not null default now()
);
alter table public.shop_quotas enable row level security;
revoke all on public.shop_quotas from public,anon,authenticated;

create or replace function public.enforce_shop_product_quota() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare limit_value integer;
begin
 select max_products into limit_value from shop_quotas where shop_id=new.shop_id;
 if limit_value is null then limit_value:=10000; end if;
 if tg_op='INSERT' and (select count(*) from items where shop_id=new.shop_id) >= limit_value then raise exception 'Product limit reached for this shop'; end if;
 return new;
end $$;
drop trigger if exists enforce_shop_product_quota on items;
create trigger enforce_shop_product_quota before insert on items for each row execute function public.enforce_shop_product_quota();

create or replace function public.enforce_shop_invoice_quota() returns trigger
language plpgsql security definer set search_path=public,extensions as $$
declare limit_value integer;
begin
 select max_invoices_month into limit_value from shop_quotas where shop_id=new.shop_id;
 if limit_value is null then limit_value:=100000; end if;
 if (select count(*) from retail_invoices where shop_id=new.shop_id and created_at >= date_trunc('month',now())) >= limit_value then raise exception 'Monthly invoice limit reached for this shop'; end if;
 return new;
end $$;
drop trigger if exists enforce_shop_invoice_quota on retail_invoices;
create trigger enforce_shop_invoice_quota before insert on retail_invoices for each row execute function public.enforce_shop_invoice_quota();

create or replace view public.retail_shop_daily_summary as
select shop_id,(created_at at time zone 'Asia/Kolkata')::date as day,count(*)::bigint as invoice_count,
 coalesce(sum(subtotal),0)::numeric(14,2) as taxable_sales,coalesce(sum(tax),0)::numeric(14,2) as tax_collected,
 coalesce(sum(total),0)::numeric(14,2) as gross_sales,coalesce(sum(cost),0)::numeric(14,2) as cost_of_goods,
 coalesce(sum(total-cost),0)::numeric(14,2) as gross_profit
from retail_invoices group by shop_id,(created_at at time zone 'Asia/Kolkata')::date;
revoke all on public.retail_shop_daily_summary from public,anon,authenticated;
create materialized view if not exists public.retail_shop_daily_summary_mv as
select * from public.retail_shop_daily_summary with no data;
create unique index if not exists retail_shop_daily_summary_mv_pk on public.retail_shop_daily_summary_mv(shop_id,day);
refresh materialized view public.retail_shop_daily_summary_mv;

create or replace function public.retail_workspace_page(p_token uuid,p_shop_id uuid,p_from date,p_to date,p_entity text,p_limit integer default 50,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare result jsonb; safe_limit integer:=least(greatest(coalesce(p_limit,50),1),200); safe_offset integer:=greatest(coalesce(p_offset,0),0); total_count bigint;
begin
 if not can_access_shop(p_token,p_shop_id) then raise exception 'Shop access required'; end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Choose a range of up to 366 days'; end if;
 if p_entity='products' then select count(*) into total_count from items where shop_id=p_shop_id; select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]') into result from (select i.* from items i where i.shop_id=p_shop_id order by i.name limit safe_limit offset safe_offset)x;
 elsif p_entity='contacts' then select count(*) into total_count from retail_contacts where shop_id=p_shop_id; select coalesce(jsonb_agg(to_jsonb(x) order by x.name),'[]') into result from (select c.* from retail_contacts c where c.shop_id=p_shop_id order by c.name limit safe_limit offset safe_offset)x;
 elsif p_entity='invoices' then select count(*) into total_count from retail_invoices where shop_id=p_shop_id and (created_at at time zone 'Asia/Kolkata')::date between p_from and p_to; select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into result from (select i.* from retail_invoices i where i.shop_id=p_shop_id and (i.created_at at time zone 'Asia/Kolkata')::date between p_from and p_to order by i.created_at desc limit safe_limit offset safe_offset)x;
 elsif p_entity='movements' then select count(*) into total_count from retail_movements where shop_id=p_shop_id and (created_at at time zone 'Asia/Kolkata')::date between p_from and p_to; select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into result from (select m.* from retail_movements m where m.shop_id=p_shop_id and (m.created_at at time zone 'Asia/Kolkata')::date between p_from and p_to order by m.created_at desc limit safe_limit offset safe_offset)x;
 else raise exception 'Unknown page entity'; end if;
 return jsonb_build_object('entity',p_entity,'items',coalesce(result,'[]'),'total',total_count,'limit',safe_limit,'offset',safe_offset);
end $$;
revoke all on function public.retail_workspace_page(uuid,uuid,date,date,text,integer,integer) from public,anon,authenticated;
grant execute on function public.retail_workspace_page(uuid,uuid,date,date,text,integer,integer) to anon,authenticated;

create or replace function public.retail_refresh_summary() returns void
language plpgsql security definer set search_path=public,extensions as $$ begin refresh materialized view public.retail_shop_daily_summary_mv; end $$;
revoke all on function public.retail_refresh_summary() from public,anon,authenticated;
notify pgrst,'reload schema';

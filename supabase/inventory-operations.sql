-- Applied after the base schema. Existing products and sales are preserved.
alter table public.sales add column if not exists request_id uuid;
create unique index if not exists sales_shop_request on public.sales(shop_id, request_id) where request_id is not null;
alter table public.sales alter column sale_date set default ((now() at time zone 'Asia/Kolkata')::date);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  item_name text not null,
  previous_stock integer not null,
  counted_stock integer not null,
  actor_role text not null,
  created_at timestamptz not null default now()
);
alter table public.stock_adjustments enable row level security;
revoke all on public.stock_adjustments from anon, authenticated;
create index if not exists stock_adjustments_shop_date on public.stock_adjustments(shop_id, created_at desc);

create or replace function public.edit_item(
  p_token uuid, p_item_id uuid, p_name text, p_category text,
  p_buying_price numeric, p_selling_price numeric, p_reorder_level integer
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare target items%rowtype;
begin
  select * into target from items where id = p_item_id for update;
  if not found or not can_access_shop(p_token, target.shop_id) then raise exception 'Shop access required'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 120
    or p_category is null or length(trim(p_category)) not between 1 and 80
    or p_buying_price is null or p_buying_price not between 0 and 9999999999.99
    or p_selling_price is null or p_selling_price not between 0 and 9999999999.99
    or round(p_buying_price,2) <> p_buying_price or round(p_selling_price,2) <> p_selling_price
    or p_reorder_level is null or p_reorder_level < 0 then raise exception 'VALIDATION'; end if;
  update items set name = trim(p_name), category = trim(p_category), buying_price = p_buying_price,
    default_selling_price = p_selling_price, reorder_level = p_reorder_level where id = p_item_id;
  return jsonb_build_object('id', p_item_id);
end;
$$;

create or replace function public.delete_item(p_token uuid, p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare target items%rowtype;
begin
  select * into target from items where id = p_item_id for update;
  if not found or not can_access_shop(p_token, target.shop_id) then raise exception 'Shop access required'; end if;
  delete from items where id = p_item_id;
  return jsonb_build_object('id', p_item_id);
end;
$$;

create or replace function public.set_stock_checked(p_token uuid, p_item_id uuid, p_stock integer, p_expected_stock integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare target items%rowtype;
begin
  select * into target from items where id = p_item_id for update;
  if not found or not can_access_shop(p_token, target.shop_id) then raise exception 'Shop access required'; end if;
  if p_stock is null or p_stock < 0 or p_expected_stock is null then raise exception 'VALIDATION'; end if;
  if target.stock <> p_expected_stock then raise exception 'STOCK_CHANGED'; end if;
  insert into stock_adjustments(shop_id,item_id,item_name,previous_stock,counted_stock,actor_role)
    values(target.shop_id,target.id,target.name,target.stock,p_stock,
      (select role from app_sessions where token = p_token));
  update items set stock = p_stock where id = p_item_id;
  return jsonb_build_object('id',p_item_id,'name',target.name,'category',target.category,
    'stock',p_stock,'buyingPrice',target.buying_price,'defaultSellingPrice',target.default_selling_price,'reorderLevel',target.reorder_level);
end;
$$;

create or replace function public.record_sale_v2(
  p_token uuid, p_shop_id uuid, p_item_id uuid, p_qty integer, p_sold_price numeric, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare target items%rowtype; sale_row sales%rowtype;
begin
  if not can_access_shop(p_token, p_shop_id) then raise exception 'Shop access required'; end if;
  if p_request_id is null or p_qty is null or p_qty <= 0 or p_sold_price is null
    or p_sold_price not between 0 and 9999999999.99 or round(p_sold_price,2) <> p_sold_price then raise exception 'VALIDATION'; end if;
  -- Serialize a repeated submission, including requests arriving on different connections.
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text || p_request_id::text,0));
  select * into sale_row from sales where shop_id = p_shop_id and request_id = p_request_id;
  if found then
    if (sale_row.item_id is not null and sale_row.item_id <> p_item_id) or sale_row.qty <> p_qty or sale_row.sold_price <> p_sold_price then raise exception 'VALIDATION: request reused'; end if;
    return jsonb_build_object('id',sale_row.id,'duplicate',true);
  end if;
  select * into target from items where id = p_item_id and shop_id = p_shop_id for update;
  if not found then raise exception 'VALIDATION: item not found'; end if;
  if p_qty > target.stock then raise exception 'INSUFFICIENT_STOCK'; end if;
  update items set stock = stock - p_qty where id = p_item_id;
  insert into sales(shop_id,item_id,item_name,qty,buying_price,sold_price,sale_date,request_id)
    values(p_shop_id,p_item_id,target.name,p_qty,target.buying_price,p_sold_price,(now() at time zone 'Asia/Kolkata')::date,p_request_id)
    returning * into sale_row;
  return jsonb_build_object('id',sale_row.id,'itemId',sale_row.item_id,'itemName',sale_row.item_name,
    'qty',sale_row.qty,'buyingPrice',sale_row.buying_price,'soldPrice',sale_row.sold_price,
    'date',sale_row.sale_date,'remainingStock',target.stock-p_qty);
end;
$$;

-- Keep earlier clients compatible while enforcing the corrected validation.
create or replace function public.record_sale(p_token uuid,p_shop_id uuid,p_item_id uuid,p_qty integer,p_sold_price numeric)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select record_sale_v2(p_token,p_shop_id,p_item_id,p_qty,p_sold_price,gen_random_uuid());
$$;
create or replace function public.update_stock(p_token uuid,p_item_id uuid,p_stock integer)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare target items%rowtype;
begin
  select * into target from items where id = p_item_id for update;
  return set_stock_checked(p_token,p_item_id,p_stock,target.stock);
end;
$$;

revoke all on function public.edit_item(uuid,uuid,text,text,numeric,numeric,integer) from public;
revoke all on function public.delete_item(uuid,uuid) from public;
revoke all on function public.set_stock_checked(uuid,uuid,integer,integer) from public;
revoke all on function public.record_sale_v2(uuid,uuid,uuid,integer,numeric,uuid) from public;
grant execute on function public.edit_item(uuid,uuid,text,text,numeric,numeric,integer) to anon, authenticated;
grant execute on function public.delete_item(uuid,uuid) to anon, authenticated;
grant execute on function public.set_stock_checked(uuid,uuid,integer,integer) to anon, authenticated;
grant execute on function public.record_sale_v2(uuid,uuid,uuid,integer,numeric,uuid) to anon, authenticated;

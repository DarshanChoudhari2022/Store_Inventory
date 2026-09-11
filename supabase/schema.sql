create extension if not exists pgcrypto;

create table if not exists owner_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null default 'Pune',
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  category text not null default 'General',
  buying_price numeric(12, 2) not null default 0,
  default_selling_price numeric(12, 2) not null default 0,
  stock integer not null default 0 check (stock >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  item_name text not null,
  qty integer not null check (qty > 0),
  buying_price numeric(12, 2) not null default 0,
  sold_price numeric(12, 2) not null default 0,
  sale_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  created_at timestamptz not null default now()
);

create table if not exists app_sessions (
  token uuid primary key default gen_random_uuid(),
  role text not null check (role in ('owner', 'shop')),
  shop_id uuid references shops(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_role_expires on app_sessions(role, expires_at);
create index if not exists idx_app_sessions_shop_expires on app_sessions(shop_id, expires_at);
create index if not exists idx_items_shop_created on items(shop_id, created_at);
create index if not exists idx_items_shop_stock on items(shop_id, stock, reorder_level);
create index if not exists idx_sales_shop_date_created on sales(shop_id, sale_date, created_at desc);
create index if not exists idx_sales_date on sales(sale_date);

alter table owner_accounts enable row level security;
alter table shops enable row level security;
alter table items enable row level security;
alter table sales enable row level security;
alter table app_sessions enable row level security;

revoke all on owner_accounts from anon, authenticated;
revoke all on shops from anon, authenticated;
revoke all on items from anon, authenticated;
revoke all on sales from anon, authenticated;
revoke all on app_sessions from anon, authenticated;

create or replace function is_owner_session(p_token uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from app_sessions
    where token = p_token
      and role = 'owner'
      and expires_at > now()
  );
$$;

create or replace function can_access_shop(p_token uuid, p_shop_id uuid)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from app_sessions
    where token = p_token
      and expires_at > now()
      and (role = 'owner' or shop_id = p_shop_id)
  );
$$;

create or replace function public.login_user(p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  owner_row owner_accounts%rowtype;
  shop_row shops%rowtype;
  new_token uuid;
begin
  delete from app_sessions where expires_at <= now();

  select * into owner_row
  from owner_accounts
  where username = p_username
    and password_hash = crypt(p_password, password_hash);

  if found then
    insert into app_sessions(role) values ('owner') returning token into new_token;
    return jsonb_build_object('token', new_token, 'role', 'owner');
  end if;

  select * into shop_row
  from shops
  where username = p_username
    and password_hash = crypt(p_password, password_hash);

  if found then
    insert into app_sessions(role, shop_id) values ('shop', shop_row.id) returning token into new_token;
    return jsonb_build_object(
      'token', new_token,
      'role', 'shop',
      'shopId', shop_row.id,
      'shopName', shop_row.name
    );
  end if;

  raise exception 'Invalid username or password';
end;
$$;

create or replace function public.logout_user(p_token uuid)
returns void
language sql
security definer
set search_path = public, extensions
as $$
  delete from app_sessions where token = p_token;
$$;

create or replace function public.list_shops(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select case
    when not is_owner_session(p_token) then '[]'::jsonb
    else coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'area', area,
          'username', username,
          'itemCount', (select count(*) from items where items.shop_id = shops.id),
          'createdAt', created_at
        )
        order by created_at
      ),
      '[]'::jsonb
    )
  end
  from shops;
$$;

create or replace function public.owner_summary(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result jsonb;
begin
  if not is_owner_session(p_token) then
    raise exception 'Owner access required';
  end if;

  select jsonb_build_object(
    'shopCount', (select count(*) from shops),
    'revenue', coalesce((select sum(sold_price * qty) from sales where sale_date = (now() at time zone 'Asia/Kolkata')::date), 0),
    'profit', coalesce((select sum((sold_price - buying_price) * qty) from sales where sale_date = (now() at time zone 'Asia/Kolkata')::date), 0),
    'inventoryValue', coalesce((select sum(stock * buying_price) from items), 0),
    'lowStockCount', (select count(*) from items where stock <= reorder_level)
  )
  into result;

  return result;
end;
$$;

create or replace function public.get_shop_dashboard(p_token uuid, p_shop_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  result jsonb;
begin
  if not can_access_shop(p_token, p_shop_id) then
    raise exception 'Shop access required';
  end if;

  select jsonb_build_object(
    'shop', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'area', s.area,
      'username', s.username
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'name', i.name,
          'category', i.category,
          'buyingPrice', i.buying_price,
          'defaultSellingPrice', i.default_selling_price,
          'stock', i.stock,
          'reorderLevel', i.reorder_level
        )
        order by i.created_at
      )
      from items i
      where i.shop_id = s.id
    ), '[]'::jsonb),
    'todaysSales', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sale.id,
          'itemId', sale.item_id,
          'itemName', sale.item_name,
          'qty', sale.qty,
          'buyingPrice', sale.buying_price,
          'soldPrice', sale.sold_price,
          'date', sale.sale_date
        )
        order by sale.created_at desc
      )
      from sales sale
      where sale.shop_id = s.id and sale.sale_date = (now() at time zone 'Asia/Kolkata')::date
    ), '[]'::jsonb)
  )
  into result
  from shops s
  where s.id = p_shop_id;

  return result;
end;
$$;

create or replace function public.create_shop(
  p_token uuid,
  p_name text,
  p_area text,
  p_username text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_shop shops%rowtype;
begin
  if not is_owner_session(p_token) then
    raise exception 'Owner access required';
  end if;

  if p_name is null or length(trim(p_name)) not between 1 and 120
    or p_password is null or length(p_password) < 12 then raise exception 'VALIDATION'; end if;
  insert into shops(name, area, username, password_hash)
  values (p_name, coalesce(nullif(p_area, ''), 'Pune'), p_username, crypt(p_password, gen_salt('bf')))
  returning * into new_shop;

  return jsonb_build_object(
    'id', new_shop.id,
    'name', new_shop.name,
    'area', new_shop.area,
    'username', new_shop.username,
    'password', p_password
  );
end;
$$;

create or replace function public.reset_shop_password(p_token uuid, p_shop_id uuid, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  updated_shop shops%rowtype;
begin
  if not is_owner_session(p_token) then
    raise exception 'Owner access required';
  end if;

  if p_password is null or length(p_password) < 12 then raise exception 'VALIDATION'; end if;
  delete from app_sessions where shop_id = p_shop_id;
  update shops
  set password_hash = crypt(p_password, gen_salt('bf'))
  where id = p_shop_id
  returning * into updated_shop;

  return jsonb_build_object(
    'id', updated_shop.id,
    'name', updated_shop.name,
    'username', updated_shop.username,
    'password', p_password
  );
end;
$$;

create or replace function public.add_item(
  p_token uuid,
  p_shop_id uuid,
  p_name text,
  p_category text,
  p_buying_price numeric,
  p_selling_price numeric,
  p_stock integer,
  p_reorder_level integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_item items%rowtype;
begin
  if not can_access_shop(p_token, p_shop_id) then
    raise exception 'Shop access required';
  end if;

  if p_name is null or length(trim(p_name)) not between 1 and 120
    or p_category is null or length(trim(p_category)) not between 1 and 80
    or p_buying_price is null or p_buying_price not between 0 and 9999999999.99
    or p_selling_price is null or p_selling_price not between 0 and 9999999999.99
    or round(p_buying_price,2) <> p_buying_price or round(p_selling_price,2) <> p_selling_price
    or p_stock is null or p_stock < 0 or p_reorder_level is null or p_reorder_level < 0
    then raise exception 'VALIDATION'; end if;

  insert into items(shop_id, name, category, buying_price, default_selling_price, stock, reorder_level)
  values (
    p_shop_id,
    p_name,
    coalesce(nullif(p_category, ''), 'General'),
    coalesce(p_buying_price, 0),
    coalesce(p_selling_price, 0),
    greatest(coalesce(p_stock, 0), 0),
    greatest(coalesce(p_reorder_level, 0), 0)
  )
  returning * into new_item;

  return jsonb_build_object(
    'id', new_item.id,
    'name', new_item.name,
    'category', new_item.category,
    'buyingPrice', new_item.buying_price,
    'defaultSellingPrice', new_item.default_selling_price,
    'stock', new_item.stock,
    'reorderLevel', new_item.reorder_level
  );
end;
$$;

drop function if exists public.update_stock(uuid, uuid, integer);

create or replace function public.update_stock(p_token uuid, p_item_id uuid, p_stock integer)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_shop uuid;
  updated_item items%rowtype;
begin
  select shop_id into target_shop from items where id = p_item_id;

  if target_shop is null or not can_access_shop(p_token, target_shop) then
    raise exception 'Shop access required';
  end if;

  update items
  set stock = greatest(coalesce(p_stock, 0), 0)
  where id = p_item_id
  returning * into updated_item;

  return jsonb_build_object(
    'id', updated_item.id,
    'name', updated_item.name,
    'category', updated_item.category,
    'buyingPrice', updated_item.buying_price,
    'defaultSellingPrice', updated_item.default_selling_price,
    'stock', updated_item.stock,
    'reorderLevel', updated_item.reorder_level
  );
end;
$$;

create or replace function public.record_sale(
  p_token uuid,
  p_shop_id uuid,
  p_item_id uuid,
  p_qty integer,
  p_sold_price numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  item_row items%rowtype;
  sellable_qty integer;
  new_sale sales%rowtype;
begin
  if not can_access_shop(p_token, p_shop_id) then
    raise exception 'Shop access required';
  end if;

  select * into item_row
  from items
  where id = p_item_id and shop_id = p_shop_id
  for update;

  if not found then
    raise exception 'Item not found';
  end if;

  if p_qty is null or p_qty <= 0 or p_sold_price is null or p_sold_price < 0 then raise exception 'VALIDATION'; end if;
  if p_qty > item_row.stock then raise exception 'INSUFFICIENT_STOCK'; end if;
  sellable_qty := p_qty;

  if sellable_qty <= 0 then
    raise exception 'Item is out of stock';
  end if;

  update items
  set stock = stock - sellable_qty
  where id = item_row.id;

  insert into sales(shop_id, item_id, item_name, qty, buying_price, sold_price)
  values (p_shop_id, p_item_id, item_row.name, sellable_qty, item_row.buying_price, coalesce(p_sold_price, 0))
  returning * into new_sale;

  return jsonb_build_object(
    'id', new_sale.id,
    'itemId', new_sale.item_id,
    'itemName', new_sale.item_name,
    'qty', new_sale.qty,
    'buyingPrice', new_sale.buying_price,
    'soldPrice', new_sale.sold_price,
    'date', new_sale.sale_date,
    'remainingStock', item_row.stock - sellable_qty
  );
end;
$$;

grant execute on function public.login_user(text, text) to anon, authenticated;
grant execute on function public.logout_user(uuid) to anon, authenticated;
grant execute on function public.list_shops(uuid) to anon, authenticated;
grant execute on function public.owner_summary(uuid) to anon, authenticated;
grant execute on function public.get_shop_dashboard(uuid, uuid) to anon, authenticated;
grant execute on function public.create_shop(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.reset_shop_password(uuid, uuid, text) to anon, authenticated;
grant execute on function public.add_item(uuid, uuid, text, text, numeric, numeric, integer, integer) to anon, authenticated;
grant execute on function public.update_stock(uuid, uuid, integer) to anon, authenticated;
grant execute on function public.record_sale(uuid, uuid, uuid, integer, numeric) to anon, authenticated;
